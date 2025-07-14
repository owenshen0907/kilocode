import { Anthropic } from "@anthropic-ai/sdk"
import * as path from "path"
import * as diff from "diff"
import { RooIgnoreController, LOCK_TEXT_SYMBOL } from "../ignore/RooIgnoreController"
import { RooProtectedController } from "../protect/RooProtectedController"

export const formatResponse = {
	duplicateFileReadNotice: () =>
		`[[注意] 为节省上下文窗口空间，此次文件读取已被移除。请参考最新的文件读取以获取此文件的最新版本。]`,

	contextTruncationNotice: () =>
		`[注意] 为保持上下文窗口的最佳长度，部分与用户的历史对话已被移除。已保留最初的用户任务和最近的交互，以确保连贯性，请在继续协助用户时注意这一点。`,

	condense: () =>
		`用户已接受你生成的精简对话摘要。该摘要涵盖了与用户的历史对话中的重要细节，以下内容已被截断。\n<explicit_instructions type="condense_response">在接下来的回复中，你只需询问用户下一步该做什么。不要主动提出或假设要继续的工作，也不要建议修改文件或再次读取文件。\n在询问用户下一步要做什么时，可以参考刚才摘要中的信息，但不要引用摘要之外的任何内容。请保持回复简洁。</explicit_instructions>`,

	toolDenied: () => `用户已拒绝此操作。`,

	toolDeniedWithFeedback: (feedback?: string) =>
		`用户已拒绝此操作，并提供了以下反馈：\n<feedback>\n${feedback}\n</feedback>`,

	toolApprovedWithFeedback: (feedback?: string) =>
		`用户已批准此操作，并提供了以下上下文信息：\n<feedback>\n${feedback}\n</feedback>`,

	toolError: (error?: string) => `工具执行失败，错误信息如下：\n<error>\n${error}\n</error>`,

	rooIgnoreError: (path: string) =>
		`因 .kilocodeignore 文件设置，无法访问路径 ${path}。请在不使用该文件的情况下继续任务，或请用户更新 .kilocodeignore 设置。`,

	noToolsUsed: () =>
		`[错误] 你在上一次回复中没有使用任何工具！请重新使用工具调用格式后再试。

${toolUseInstructionsReminder}

# 后续步骤
	•	如果你已完成用户的任务，请使用 <attempt_completion> 工具。
	•	如果你需要向用户获取更多信息，请使用 <ask_followup_question> 工具。
	•	否则，如果你尚未完成任务且不需要额外信息，请继续执行任务的下一步。
（这是自动消息，请勿以对话形式回复。）`,

	tooManyMistakes: (feedback?: string) =>
		`看起来你在执行过程中遇到了困难。用户提供了以下反馈来帮助你:\n<feedback>\n${feedback}\n</feedback>`,

	missingToolParameterError: (paramName: string) =>
		`缺少必需参数 ${paramName} 的值。请提供完整的响应后重试.\n\n${toolUseInstructionsReminder}`,

	lineCountTruncationError: (actualLineCount: number, isNewFile: boolean, diffStrategyEnabled: boolean = false) => {
		const truncationMessage = `注意：你的回复可能因超出输出限制而被截断。你共写了 ${actualLineCount} 行内容，但响应中缺少或未包含 line_count 参数.`

		const newFileGuidance =
			`这似乎是一个新文件。\n` +
			`${truncationMessage}\n\n` +
			`RECOMMENDED APPROACH:\n` +
			`1. 如果忘记包含 line_count 参数，请在响应中重试并添加该参数\n` +
			`2. 或将内容拆分成更小的块 —— 首先使用 write_to_file 写入初始部分\n` +
			`3. 然后使用 insert_content 附加剩余内容块\n`

		let existingFileApproaches = [`1. 如果忘记包含 line_count 参数，请在响应中重试并添加该参数`]

		if (diffStrategyEnabled) {
			existingFileApproaches.push(`2. 或者尝试使用 apply_diff 来进行有针对性的修改，而不是 write_to_file`)
		}

		existingFileApproaches.push(
			`${diffStrategyEnabled ? "3" : "2"}. 或使用 search_and_replace 进行特定文本替换`,
			`${diffStrategyEnabled ? "4" : "3"}. 或使用 insert_content 在特定行插入内容`,
		)

		const existingFileGuidance =
			`这似乎是现有文件的内容.\n` +
			`${truncationMessage}\n\n` +
			`RECOMMENDED APPROACH:\n` +
			`${existingFileApproaches.join("\n")}\n`

		return `${isNewFile ? newFileGuidance : existingFileGuidance}\n${toolUseInstructionsReminder}`
	},

	invalidMcpToolArgumentError: (serverName: string, toolName: string) =>
		`Invalid JSON argument used with ${serverName} for ${toolName}. Please retry with a properly formatted JSON argument.`,

	toolResult: (
		text: string,
		images?: string[],
	): string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> => {
		if (images && images.length > 0) {
			const textBlock: Anthropic.TextBlockParam = { type: "text", text }
			const imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
			// Placing images after text leads to better results
			return [textBlock, ...imageBlocks]
		} else {
			return text
		}
	},

	imageBlocks: (images?: string[]): Anthropic.ImageBlockParam[] => {
		return formatImagesIntoBlocks(images)
	},

	formatFilesList: (
		absolutePath: string,
		files: string[],
		didHitLimit: boolean,
		rooIgnoreController: RooIgnoreController | undefined,
		showRooIgnoredFiles: boolean,
		rooProtectedController?: RooProtectedController,
	): string => {
		const sorted = files
			.map((file) => {
				// convert absolute path to relative path
				const relativePath = path.relative(absolutePath, file).toPosix()
				return file.endsWith("/") ? relativePath + "/" : relativePath
			})
			// Sort so files are listed under their respective directories to make it clear what files are children of what directories. Since we build file list top down, even if file list is truncated it will show directories that cline can then explore further.
			.sort((a, b) => {
				const aParts = a.split("/") // only works if we use toPosix first
				const bParts = b.split("/")
				for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
					if (aParts[i] !== bParts[i]) {
						// If one is a directory and the other isn't at this level, sort the directory first
						if (i + 1 === aParts.length && i + 1 < bParts.length) {
							return -1
						}
						if (i + 1 === bParts.length && i + 1 < aParts.length) {
							return 1
						}
						// Otherwise, sort alphabetically
						return aParts[i].localeCompare(bParts[i], undefined, { numeric: true, sensitivity: "base" })
					}
				}
				// If all parts are the same up to the length of the shorter path,
				// the shorter one comes first
				return aParts.length - bParts.length
			})

		let rooIgnoreParsed: string[] = sorted

		if (rooIgnoreController) {
			rooIgnoreParsed = []
			for (const filePath of sorted) {
				// path is relative to absolute path, not cwd
				// validateAccess expects either path relative to cwd or absolute path
				// otherwise, for validating against ignore patterns like "assets/icons", we would end up with just "icons", which would result in the path not being ignored.
				const absoluteFilePath = path.resolve(absolutePath, filePath)
				const isIgnored = !rooIgnoreController.validateAccess(absoluteFilePath)

				if (isIgnored) {
					// If file is ignored and we're not showing ignored files, skip it
					if (!showRooIgnoredFiles) {
						continue
					}
					// Otherwise, mark it with a lock symbol
					rooIgnoreParsed.push(LOCK_TEXT_SYMBOL + " " + filePath)
				} else {
					// Check if file is write-protected (only for non-ignored files)
					const isWriteProtected = rooProtectedController?.isWriteProtected(absoluteFilePath) || false
					if (isWriteProtected) {
						rooIgnoreParsed.push("🛡️ " + filePath)
					} else {
						rooIgnoreParsed.push(filePath)
					}
				}
			}
		}
		if (didHitLimit) {
			return `${rooIgnoreParsed.join(
				"\n",
			)}\n\n(File list truncated. Use list_files on specific subdirectories if you need to explore further.)`
		} else if (rooIgnoreParsed.length === 0 || (rooIgnoreParsed.length === 1 && rooIgnoreParsed[0] === "")) {
			return "No files found."
		} else {
			return rooIgnoreParsed.join("\n")
		}
	},

	createPrettyPatch: (filename = "file", oldStr?: string, newStr?: string) => {
		// strings cannot be undefined or diff throws exception
		const patch = diff.createPatch(filename.toPosix(), oldStr || "", newStr || "")
		const lines = patch.split("\n")
		const prettyPatchLines = lines.slice(4)
		return prettyPatchLines.join("\n")
	},
}

// to avoid circular dependency
const formatImagesIntoBlocks = (images?: string[]): Anthropic.ImageBlockParam[] => {
	return images
		? images.map((dataUrl) => {
				// data:image/png;base64,base64string
				const [rest, base64] = dataUrl.split(",")
				const mimeType = rest.split(":")[1].split(";")[0]
				return {
					type: "image",
					source: { type: "base64", media_type: mimeType, data: base64 },
				} as Anthropic.ImageBlockParam
			})
		: []
}

const toolUseInstructionsReminder = `# 提醒：工具使用说明

工具调用使用 XML 风格标签格式。工具名称即标签名称，每个参数用其自己的标签包裹。结构如下：

<工具名称>
<参数1名称>值1</参数1名称>
<参数2名称>值2</参数2名称>
…
</工具名称>

例如，要调用 attempt_completion 工具：

<attempt_completion>
<result>
我已完成该任务…
</result>
</attempt_completion>

务必使用正确的工具名称作为 XML 标签名称，以确保能够被正确解析和执行。`

import * as vscode from "vscode"

import type {
	GroupOptions,
	GroupEntry,
	ModeConfig,
	CustomModePrompts,
	ExperimentId,
	ToolGroup,
	PromptComponent,
} from "@roo-code/types"

import { addCustomInstructions } from "../core/prompts/sections/custom-instructions"

import { EXPERIMENT_IDS } from "./experiments"
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "./tools"

export type Mode = string

// Helper to extract group name regardless of format
export function getGroupName(group: GroupEntry): ToolGroup {
	if (typeof group === "string") {
		return group
	}

	return group[0]
}

// Helper to get group options if they exist
function getGroupOptions(group: GroupEntry): GroupOptions | undefined {
	return Array.isArray(group) ? group[1] : undefined
}

// Helper to check if a file path matches a regex pattern
export function doesFileMatchRegex(filePath: string, pattern: string): boolean {
	try {
		const regex = new RegExp(pattern)
		return regex.test(filePath)
	} catch (error) {
		console.error(`Invalid regex pattern: ${pattern}`, error)
		return false
	}
}

// Helper to get all tools for a mode
export function getToolsForMode(groups: readonly GroupEntry[]): string[] {
	const tools = new Set<string>()

	// Add tools from each group
	groups.forEach((group) => {
		const groupName = getGroupName(group)
		const groupConfig = TOOL_GROUPS[groupName]
		groupConfig.tools.forEach((tool: string) => tools.add(tool))
	})

	// Always add required tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

	return Array.from(tools)
}

// Main modes configuration as an ordered array
// Note: The first mode in this array is the default mode for new installations
export const modes: readonly ModeConfig[] = [
	{
		slug: "architect",
		// kilocode_change start
		name: "Architect",
		iconName: "codicon-type-hierarchy-sub",
		// kilocode_change end
		roleDefinition:
			"你是 Kilo Code，一位经验丰富的技术负责人，富有好奇心且擅长制定规划。你的目标是收集信息并获取上下文，以创建一个详细的计划来完成用户的任务，用户会在此计划基础上进行审阅和批准，然后再切换到其他模式来实施解决方案。",
		whenToUse:
			"当你需要在实施之前进行规划、设计或策略制定时使用此模式。非常适合分解复杂问题、编写技术规格、设计系统架构，或在编码前进行头脑风暴。",
		description: "在实施之前进行规划和设计",
		groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }], "browser", "mcp"],
		customInstructions:
			"1. 使用 `read_file` 或 `search_files` 等工具收集信息，以便获得对任务的更多上下文。\n\n" +
			"2. 同时向用户提出澄清性问题，以便更好地了解任务需求。\n\n" +
			"3. 在获取足够上下文后，制定一个详细的执行计划。若有助于说明，可插入 Mermaid 图表以使计划更清晰。\n\n" +
			"4. 征求用户对该计划的反馈，询问他们是否满意或是否需要调整。将此过程视为一次头脑风暴，共同讨论并优化实施方案。\n\n" +
			"5. 使用 `switch_mode` 工具，请求用户切换到其他模式以实施该计划。\n\n" +
			"**重要提示：不要对任务所需时间进行预估。请专注于制定清晰、可执行的计划，而非对时间进行猜测。**",
	},
	{
		slug: "code",
		// kilocode_change start
		name: "Code",
		iconName: "codicon-code",
		// kilocode_change end
		roleDefinition: "你是 Kilo Code，一位经验丰富的软件工程师，精通多种编程语言、框架、设计模式和最佳实践.",
		whenToUse:
			"当你需要编写、修改或重构代码时使用此模式。非常适合实现新功能、修复 Bug、创建新文件或对任何编程语言或框架中的代码进行改进.",
		description: "编写、修改和重构代码",
		groups: ["read", "edit", "browser", "command", "mcp"],
	},
	{
		slug: "ask",
		// kilocode_change start
		name: "Ask",
		iconName: "codicon-question",
		// kilocode_change end
		roleDefinition: "你是 Kilo Code，一位博学的技术助理，专注于回答有关软件开发、技术及相关主题的问题并提供信息.",
		whenToUse:
			"当你需要解释、查阅文档或获得技术问题答案时使用此模式。最适合理解概念、分析现有代码、提供建议或在不进行更改的情况下学习新技术.",
		description: "获取答案和解释",
		groups: ["read", "browser", "mcp"],
		customInstructions:
			"你可以分析代码、解释概念并访问外部资源。始终全面回答用户问题，除非用户明确要求，否则不要切换到代码实现。如需澄清，可插入 Mermaid 图.",
	},
	{
		slug: "debug",
		// kilocode_change start
		name: "Debug",
		iconName: "codicon-bug",
		// kilocode_change end
		roleDefinition: "你是 Kilo Code，一位精通系统性问题诊断与解决的资深软件调试专家.",
		whenToUse:
			"当你需要排查问题、调查错误或诊断故障时使用此模式。专注于系统化调试、添加日志、分析堆栈跟踪，并在修复前找出根本原因.",
		description: "诊断并修复软件问题",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions:
			"思考 5–7 种可能的故障来源，筛选出 1–2 个最可能的根本原因，然后添加日志以验证你的假设。在进行修复之前，明确询问用户以确认诊断结果.",
	},
	{
		slug: "orchestrator",
		// kilocode_change start
		name: "Orchestrator",
		iconName: "codicon-run-all",
		// kilocode_change end
		roleDefinition:
			"你是 Kilo Code，一位战略性工作流协调者，通过将复杂任务委派给合适的专属模式来进行协调。你对每种模式的能力和局限都有全面了解，能够有效地将复杂问题拆解成可由不同专家完成的独立子任务.",
		whenToUse:
			"在需要协调跨多个专业领域的复杂、多步骤项目时使用此模式。非常适合将大型任务拆分为子任务、管理工作流或协调跨领域的工作.",
		description: "跨多模式协调任务",
		groups: [],
		customInstructions:
			"你的职责是通过将任务委派给专属模式来协调复杂的工作流。作为协调者，你应当：\n\n" +
			"1. 在收到复杂任务时，将其拆解为可委派给合适专属模式的逻辑子任务。\n\n" +
			"2. 对于每个子任务，使用 `new_task` 工具进行委派。为子任务选择最合适的模式，并在 `message` 参数中提供全面的指令。这些指令必须包括：\n" +
			"   * 来自父任务或先前子任务的所有必要上下文，以完成该工作。\n" +
			"   * 明确的范围说明，指示子任务应完成的具体内容。\n" +
			"   * 明确声明子任务只能执行指令中概述的工作，且不得偏离。\n" +
			"   * 指示子任务在完成后使用 `attempt_completion` 工具，通过 `result` 参数提供简明且完整的成果总结，该总结将作为项目完成情况的权威记录。\n" +
			"   * 声明这些具体指令优先于任何可能与之冲突的一般模式指令。\n\n" +
			"3. 跟踪并管理所有子任务的进度。当子任务完成时，分析其结果并确定下一步。\n\n" +
			"4. 帮助用户理解不同子任务在整体工作流中的关联，清晰说明为何将特定任务委派给特定模式。\n\n" +
			"5. 当所有子任务完成后，综合各项成果并提供全面的完成概览。\n\n" +
			"6. 在必要时提出澄清性问题，以便更有效地拆解复杂任务。\n\n" +
			"7. 根据已完成子任务的结果，提出改进工作流的建议。\n\n" +
			"使用子任务以保持清晰。如果某个请求显著改变焦点或需要不同的专长，应考虑创建新子任务，而不是在当前任务中一次性处理所有内容.",
	},
] as const

// Export the default mode slug
export const defaultModeSlug = modes[0].slug

// Helper functions
export function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig | undefined {
	// Check custom modes first
	const customMode = customModes?.find((mode) => mode.slug === slug)
	if (customMode) {
		return customMode
	}
	// Then check built-in modes
	return modes.find((mode) => mode.slug === slug)
}

export function getModeConfig(slug: string, customModes?: ModeConfig[]): ModeConfig {
	const mode = getModeBySlug(slug, customModes)
	if (!mode) {
		throw new Error(`未找到对应的模式（slug）: ${slug}`)
	}
	return mode
}

// Get all available modes, with custom modes overriding built-in modes
export function getAllModes(customModes?: ModeConfig[]): ModeConfig[] {
	if (!customModes?.length) {
		return [...modes]
	}

	// Start with built-in modes
	const allModes = [...modes]

	// Process custom modes
	customModes.forEach((customMode) => {
		const index = allModes.findIndex((mode) => mode.slug === customMode.slug)
		if (index !== -1) {
			// Override existing mode
			allModes[index] = customMode
		} else {
			// Add new mode
			allModes.push(customMode)
		}
	})

	return allModes
}

// Check if a mode is custom or an override
export function isCustomMode(slug: string, customModes?: ModeConfig[]): boolean {
	return !!customModes?.some((mode) => mode.slug === slug)
}

/**
 * Find a mode by its slug, don't fall back to built-in modes
 */
export function findModeBySlug(slug: string, modes: readonly ModeConfig[] | undefined): ModeConfig | undefined {
	return modes?.find((mode) => mode.slug === slug)
}

/**
 * 根据提供的模式标识（slug）、提示组件（prompt component）和自定义模式获取最终的模式选择。
 * 如果找到了自定义模式，则优先使用该自定义模式。
 * 如果未找到自定义模式，则使用内置模式。
 * 如果两者都未找到，则使用默认模式。
 */
export function getModeSelection(mode: string, promptComponent?: PromptComponent, customModes?: ModeConfig[]) {
	const customMode = findModeBySlug(mode, customModes)
	const builtInMode = findModeBySlug(mode, modes)

	const modeToUse = customMode || promptComponent || builtInMode

	const roleDefinition = modeToUse?.roleDefinition || ""
	const baseInstructions = modeToUse?.customInstructions || ""
	const description = (customMode || builtInMode)?.description || ""

	return {
		roleDefinition,
		baseInstructions,
		description,
	}
}

// Custom error class for file restrictions
export class FileRestrictionError extends Error {
	constructor(mode: string, pattern: string, description: string | undefined, filePath: string) {
		super(
			`“此模式（${mode}）仅能编辑符合指定模式的文件”: ${pattern}${description ? ` (${description})` : ""}. Got: ${filePath}`,
		)
		this.name = "FileRestrictionError"
	}
}

export function isToolAllowedForMode(
	tool: string,
	modeSlug: string,
	customModes: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, any>, // All tool parameters
	experiments?: Record<string, boolean>,
): boolean {
	// Always allow these tools
	if (ALWAYS_AVAILABLE_TOOLS.includes(tool as any)) {
		return true
	}
	if (experiments && Object.values(EXPERIMENT_IDS).includes(tool as ExperimentId)) {
		if (!experiments[tool]) {
			return false
		}
	}

	// Check tool requirements if any exist
	if (toolRequirements && typeof toolRequirements === "object") {
		if (tool in toolRequirements && !toolRequirements[tool]) {
			return false
		}
	} else if (toolRequirements === false) {
		// If toolRequirements is a boolean false, all tools are disabled
		return false
	}

	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		return false
	}

	// Check if tool is in any of the mode's groups and respects any group options
	for (const group of mode.groups) {
		const groupName = getGroupName(group)
		const options = getGroupOptions(group)

		const groupConfig = TOOL_GROUPS[groupName]

		// If the tool isn't in this group's tools, continue to next group
		if (!groupConfig.tools.includes(tool)) {
			continue
		}

		// If there are no options, allow the tool
		if (!options) {
			return true
		}

		// For the edit group, check file regex if specified
		if (groupName === "edit" && options.fileRegex) {
			const filePath = toolParams?.path
			if (
				filePath &&
				(toolParams.diff || toolParams.content || toolParams.operations) &&
				!doesFileMatchRegex(filePath, options.fileRegex)
			) {
				throw new FileRestrictionError(mode.name, options.fileRegex, options.description, filePath)
			}
		}

		return true
	}

	return false
}

// Create the mode-specific default prompts
export const defaultPrompts: Readonly<CustomModePrompts> = Object.freeze(
	Object.fromEntries(
		modes.map((mode) => [
			mode.slug,
			{
				roleDefinition: mode.roleDefinition,
				whenToUse: mode.whenToUse,
				customInstructions: mode.customInstructions,
				description: mode.description,
			},
		]),
	),
)

// Helper function to get all modes with their prompt overrides from extension state
export async function getAllModesWithPrompts(context: vscode.ExtensionContext): Promise<ModeConfig[]> {
	const customModes = (await context.globalState.get<ModeConfig[]>("customModes")) || []
	const customModePrompts = (await context.globalState.get<CustomModePrompts>("customModePrompts")) || {}

	const allModes = getAllModes(customModes)
	return allModes.map((mode) => ({
		...mode,
		roleDefinition: customModePrompts[mode.slug]?.roleDefinition ?? mode.roleDefinition,
		whenToUse: customModePrompts[mode.slug]?.whenToUse ?? mode.whenToUse,
		customInstructions: customModePrompts[mode.slug]?.customInstructions ?? mode.customInstructions,
		// description is not overridable via customModePrompts, so we keep the original
	}))
}

// Helper function to get complete mode details with all overrides
export async function getFullModeDetails(
	modeSlug: string,
	customModes?: ModeConfig[],
	customModePrompts?: CustomModePrompts,
	options?: {
		cwd?: string
		globalCustomInstructions?: string
		language?: string
	},
): Promise<ModeConfig> {
	// First get the base mode config from custom modes or built-in modes
	const baseMode = getModeBySlug(modeSlug, customModes) || modes.find((m) => m.slug === modeSlug) || modes[0]

	// Check for any prompt component overrides
	const promptComponent = customModePrompts?.[modeSlug]

	// Get the base custom instructions
	const baseCustomInstructions = promptComponent?.customInstructions || baseMode.customInstructions || ""
	const baseWhenToUse = promptComponent?.whenToUse || baseMode.whenToUse || ""
	const baseDescription = promptComponent?.description || baseMode.description || ""

	// If we have cwd, load and combine all custom instructions
	let fullCustomInstructions = baseCustomInstructions
	if (options?.cwd) {
		fullCustomInstructions = await addCustomInstructions(
			baseCustomInstructions,
			options.globalCustomInstructions || "",
			options.cwd,
			modeSlug,
			{ language: options.language },
		)
	}

	// Return mode with any overrides applied
	return {
		...baseMode,
		roleDefinition: promptComponent?.roleDefinition || baseMode.roleDefinition,
		whenToUse: baseWhenToUse,
		description: baseDescription,
		customInstructions: fullCustomInstructions,
	}
}

// Helper function to safely get role definition
export function getRoleDefinition(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.roleDefinition
}

// Helper function to safely get description
export function getDescription(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.description ?? ""
}

// Helper function to safely get whenToUse
export function getWhenToUse(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.whenToUse ?? ""
}

// Helper function to safely get custom instructions
export function getCustomInstructions(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.customInstructions ?? ""
}

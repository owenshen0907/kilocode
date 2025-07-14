export function getSwitchModeDescription(): string {
	return `## switch_mode  
描述：请求切换到另一种模式。当需要切换到不同的模式时使用，例如切换到 Code 模式以进行代码修改。此操作需经用户批准。  

参数：  
- mode_slug：（必填）要切换到的模式标识符（例如 "code"、"ask"、"architect"）  
- reason：（可选）切换模式的原因  

用法：  
<switch_mode>  
  <mode_slug>这里填模式标识符</mode_slug>  
  <reason>切换原因</reason>  
</switch_mode>  

示例：请求切换到 code 模式  
<switch_mode>  
  <mode_slug>code</mode_slug>  
  <reason>需要进行代码更改</reason>  
</switch_mode>`
}

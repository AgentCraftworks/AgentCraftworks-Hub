/**
 * Copilot SDK - TypeScript/Node.js Client
 *
 * JSON-RPC based SDK for programmatic control of GitHub Copilot CLI
 */
export { CopilotClient } from "./client.js";
export { CopilotSession, type AssistantMessageEvent } from "./session.js";
export { defineTool } from "./types.js";
export type { BaseHookInput, ConnectionState, ConnectionStateChange, ConnectionStateHandler, CopilotClientOptions, CustomAgentConfig, ErrorOccurredHandler, ErrorOccurredHookInput, ErrorOccurredHookOutput, ForegroundSessionInfo, GetAuthStatusResponse, GetStatusResponse, InfiniteSessionConfig, MCPLocalServerConfig, MCPRemoteServerConfig, MCPServerConfig, MessageOptions, ModelBilling, ModelCapabilities, ModelInfo, ModelPolicy, PermissionHandler, PermissionRequest, PermissionRequestResult, PostToolUseHandler, PostToolUseHookInput, PostToolUseHookOutput, PreToolUseHandler, PreToolUseHookInput, PreToolUseHookOutput, ProviderConfig, ReasoningEffort, ResumeSessionConfig, SessionConfig, SessionContext, SessionEndHandler, SessionEndHookInput, SessionEndHookOutput, SessionEvent, SessionEventHandler, SessionEventPayload, SessionEventType, SessionHooks, SessionLifecycleEvent, SessionLifecycleEventType, SessionLifecycleHandler, SessionListFilter, SessionMetadata, SessionStartHandler, SessionStartHookInput, SessionStartHookOutput, SystemMessageAppendConfig, SystemMessageConfig, SystemMessageReplaceConfig, Tool, ToolBinaryResult, ToolHandler, ToolInvocation, ToolResult, ToolResultObject, ToolResultType, TypedSessionEventHandler, TypedSessionLifecycleHandler, UserInputHandler, UserInputRequest, UserInputResponse, UserPromptSubmittedHandler, UserPromptSubmittedHookInput, UserPromptSubmittedHookOutput, ZodSchema, } from "./types.js";

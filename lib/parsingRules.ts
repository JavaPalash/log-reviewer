/**
 * Parsing Rules Configuration for Intellinum Flexi Log Reviewer
 * 
 * You can adjust regexes and patterns here if Flexi server or client log formats change.
 */

export interface ParsingRuleConfig {
  patterns: {
    // Matches standard Flexi log line header:
    // e.g. [DEBUG] 2026-08-05 08:59:55.282 [][WS-G-HK(181)-[(181)Thread-509]-[3]] UserActionLogger - Message
    // or:  [ERROR] 2026-10-01 05:30:54.814 [SA-OB-UAT(414)-[(414)Thread-1399]-[111]] LogFirePage - Message
    logHeader: RegExp;

    // Alternative log headers (e.g. without brackets around level or different timestamp formatting)
    altLogHeader: RegExp;

    // User and Session ID extraction from thread block:
    // e.g. WS-G-HK(181)-[(181)Thread-509]-[3] or SA-OB-UAT(414)
    threadUserSession: RegExp;

    // SessionMonitor line pattern:
    // e.g. Setting destroy to true, will kill stale session for username SA-OB-UAT ,session id : 414
    sessionMonitorUserSession: RegExp;

    // Screen / Page name patterns
    screenInScript: RegExp;
    screenInAction: RegExp;
    screenInOpenApp: RegExp;

    // Field event patterns:
    // e.g. runScript:_onFocus~XX_SELECT_LABEL_PRINT_TYPE:Java
    scriptEvent: RegExp;

    // FlexiRuntime.handleUI inputData:
    // e.g. FlexiRuntime.handleUI:inputData=InputData{inputType=15, value='86772088', isScan='false', target='textShipment', source='textShipment', seq='5'...}
    inputData: RegExp;

    // FlexiRuntime.handleUI action:
    // e.g. FlexiRuntime.handleUI: MOUSE_ENTER with value '1' from source 'menu1INBOUND' to target 'menu1INBOUND'
    // or:  FlexiRuntime.handleUI: ENTER with value '00984035390370022580' from source 'XX_SELECT_LABEL_PRINT_TYPE' to target 'XX_SELECT_LABEL_PRINT_TYPE'
    handleUIAction: RegExp;

    // REST API patterns
    restRequestMethod: RegExp;
    restRequestUrl: RegExp;
    restActionUrl: RegExp;
    restRequestBody: RegExp;
    restAuthHeader: RegExp;
    restContentType: RegExp;
    restWebserviceResult: RegExp;
    restWebserviceDuration: RegExp;
    callWebService: RegExp;

    // Session Object manipulation
    putSessionObject: RegExp;
    getSessionObject: RegExp;

    // Exceptions and Stack Traces
    exceptionStart: RegExp;
    stackTraceLine: RegExp;
    webSocketClosed: RegExp;
    webSocketSendError: RegExp;
  };

  // Keywords that classify an entry as an issue
  issueIndicators: {
    statusCodesFail: number[]; // e.g. 400, 401, 403, 404, 500, 502, 503, 504
    statusCodesWarn: number[]; // e.g. 301, 302, 409
    errorClasses: string[];
  };

  // Masking patterns for sensitive information
  sensitivePatterns: {
    authHeader: RegExp;
    tokenKey: RegExp;
    passwordKey: RegExp;
  };
}

export const PARSING_RULES: ParsingRuleConfig = {
  patterns: {
    // 1. Standard Flexi Log Header: [LEVEL] YYYY-MM-DD HH:mm:ss.SSS [ThreadBlock] Logger - Message
    logHeader: /^\[([A-Z ]{4,5})\]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s*\[(.*?)\]\s*(\S+)\s*-\s*(.*)/,

    // Alt header format (if brackets differ)
    altLogHeader: /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s*\[([A-Z]+)\]\s*\[(.*?)\]\s*(\S+)\s*-\s*(.*)/,

    // Thread block format: [][WS-G-HK(181)-[(181)Thread-509]-[3]] or [SA-OB-UAT(414)-[(414)Thread-1399]-[111]]
    threadUserSession: /([A-Za-z0-9_-]+)\((\d+)\)(?:-\[\((\d+)\)Thread-([0-9A-Za-z_-]+)\])?(?:-\[(\d+)\])?/,

    // SessionMonitor pattern
    sessionMonitorUserSession: /username\s+([A-Za-z0-9_-]+)\s*,?\s*session\s+id\s*:\s*(\d+)/i,

    // Screen detection
    screenInScript: /(?:runScript:|_onPageEntered~|_afterPageEntered~)([A-Za-z0-9_]+)(?::Java)?/i,
    screenInAction: /ActionType\s*:\s*OPEN_PAGE,\s*action\s*value\s*:\s*(?:[\w.]+\.)?([A-Za-z0-9_]+)/i,
    screenInOpenApp: /openApplication\(["']([A-Za-z0-9_]+)["']\)/i,

    // Field & event in runScript
    // e.g. runScript:_onFocus~XX_SELECT_LABEL_PRINT_TYPE:Java
    // e.g. runScript:_afterClick~XX_LABEL_PRINT_CUSTOM_NEW:Java
    // e.g. runScript:_beforeExit~textShipment:Java
    scriptEvent: /runScript:_?([A-Za-z0-9]+)~([A-Za-z0-9_]+)(?::Java)?/i,

    // inputData parser
    // FlexiRuntime.handleUI:inputData=InputData{inputType=15, value='86772088', isScan='false', target='textShipment', source='textShipment', seq='5', ...}
    inputData: /inputData=InputData\{inputType=(\d+),\s*value='(.*?)',\s*isScan='(true|false)',\s*target='(.*?)',\s*source='(.*?)'/i,

    // handleUI action
    // FlexiRuntime.handleUI: MOUSE_ENTER with value '1' from source 'menu1INBOUND' to target 'menu1INBOUND'
    handleUIAction: /handleUI:\s*([A-Z_]+)\s+with\s+value\s+'(.*?)'\s+from\s+source\s+'(.*?)'\s+to\s+target\s+'(.*?)'/i,

    // REST API
    restRequestMethod: /RestWebService\.request:\s*Request\s*Method\s*=\s*(GET|POST|PATCH|PUT|DELETE)/i,
    restRequestUrl: /RestWebService\.request:\s*URL\s*=\s*(https?:\/\/\S+)/i,
    restActionUrl: /RestWebService\.(?:postAction|patchAction|putAction|getAction):\s*(https?:\/\/\S+)/i,
    restRequestBody: /(?:RestWebService\.logRequestBody:\s*Request\s*Body\s*=|RestWebService\s+RestWebService\.(?:postAction|patchAction)\s*requestBody:)\s*([\s\S]*)/i,
    restAuthHeader: /RestWebService\.authorizationRequest:\s*(Basic\s+\S+|\S+)/i,
    restContentType: /RestWebService:\s*Content\s*Type\s*=\s*(\S+)/i,
    restWebserviceResult: /(\S+_WS|\S+WebService|\S+Page)\.runWebService:\s*result\s*(\d{3})(?:\s+([\s\S]*))?/i,
    restWebserviceDuration: /(\S+_WS|\S+WebService)\.runWebService:\s*Total\s*time\s*=\s*(\d+)\s*ms/i,
    callWebService: /(\S+_WS)\.callWebService/i,

    // Session Objects
    putSessionObject: /FlexiAPI\.putSessionObject:key:\s*([A-Za-z0-9_]+)(?:,\s*object:\s*(.*))?/i,
    getSessionObject: /FlexiAPI\.getSessionObject:key:\s*([A-Za-z0-9_]+)/i,

    // Exceptions
    exceptionStart: /^([a-zA-Z][a-zA-Z0-9_.]*(?:Exception|Error)):?(?:\s+(.*))?/,
    stackTraceLine: /^\s*at\s+([a-zA-Z0-9_$.]+)\.([a-zA-Z0-9_$]+)\(([^)]+)\)/,
    webSocketClosed: /FlexiWebSocket\.closeConnection:message\s*(.*)/i,
    webSocketSendError: /FlexiWebSocket\.send:\s*send/i,
  },

  issueIndicators: {
    statusCodesFail: [400, 401, 403, 404, 405, 408, 409, 422, 500, 502, 503, 504],
    statusCodesWarn: [301, 302, 307, 308],
    errorClasses: [
      'java.io.IOException',
      'java.lang.NullPointerException',
      'java.lang.IllegalArgumentException',
      'java.lang.ArrayIndexOutOfBoundsException',
      'java.nio.channels.ClosedChannelException',
      'org.eclipse.jetty.websocket.core.exceptions.WebSocketException',
      'com.jcraft.jsch.JSchException'
    ]
  },

  sensitivePatterns: {
    authHeader: /(Basic\s+)[A-Za-z0-9+/=]+/gi,
    tokenKey: /("(?:token|authorization|apiKey|secret|password)"\s*:\s*")([^"]+)(")/gi,
    passwordKey: /(password\s*=\s*)(\S+)/gi,
  }
};

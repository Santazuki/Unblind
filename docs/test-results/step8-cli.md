{"timestamp":"2026-05-28T03:48:28.352Z","level":"info","module":"credentialManager","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.354Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.354Z","level":"info","module":"imageProcessor","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.354Z","level":"info","module":"retry","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.354Z","level":"info","module":"mimo","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.680Z","level":"info","module":"credentialManager","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.681Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.681Z","level":"info","module":"imageProcessor","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.681Z","level":"info","module":"retry","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.681Z","level":"info","module":"mimo","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.682Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:48:28.682Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:48:28.682Z","level":"info","module":"orchestrator","event":"processing_image","path":"/nonexistent/file.png","mode":"describe"}
❌ 错误：文件不存在: /nonexistent/file.png
解决建议：请检查文件路径是否正确
{"timestamp":"2026-05-28T03:48:28.963Z","level":"info","module":"credentialManager","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.965Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.965Z","level":"info","module":"imageProcessor","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.965Z","level":"info","module":"retry","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.965Z","level":"info","module":"mimo","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.965Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:48:28.965Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
❌ 错误：未知的分析模式: invalid-mode
解决建议：支持的模式: describe, ocr, ui-review, chart-data, object-detect
▶ CLI
  ✔ should print usage when no arguments (274.3662ms)
  ✔ should fail for non-existent file (326.9273ms)
  ✔ should fail for unsupported mode (284.0089ms)
✔ CLI (886.0359ms)
{"timestamp":"2026-05-28T03:48:28.094Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:48:28.095Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:48:28.098Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:48:28.099Z","level":"info","module":"config","event":"loaded","model":"mimo-v2-omni","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:48:28.109Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:48:28.109Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
▶ config
  ✔ should return defaults when settings.json has no relevant fields (4.0987ms)
  ✔ should read user-set values (2.4143ms)
  ✔ should warn when maxImageSize > 20MB (1.8849ms)
  ✔ should apply maxImageSize default if not set (8.375ms)
✔ config (19.0954ms)
{"timestamp":"2026-05-28T03:48:28.088Z","level":"info","module":"credentialManager","event":"module_loaded"}
▶ credentialManager
  ▶ getBaseUrl
    ✔ should detect token-plan URL for tp- keys (1.3141ms)
    ✔ should detect api URL for sk- keys (0.1025ms)
    ✔ should return token-plan URL as default for unknown prefix (0.0793ms)
    ✔ should return empty string for empty key (0.0941ms)
  ✔ getBaseUrl (2.3504ms)
  ▶ getApiKey
    ✔ should read from MIMO_API_KEY env (0.1812ms)
    ✔ should return empty string if not set (0.0977ms)
  ✔ getApiKey (0.3643ms)
✔ credentialManager (3.1153ms)
{"timestamp":"2026-05-28T03:48:28.094Z","level":"info","module":"errorHandler","event":"module_loaded"}
▶ errorHandler
  ✔ ClientError should contain type, reason, suggestion (0.5011ms)
  ✔ ServerError should contain type and statusCode (0.1056ms)
  ✔ NetworkError should contain type (0.6903ms)
  ✔ formatError should produce Chinese user-facing message (0.1508ms)
✔ errorHandler (2.1402ms)
{"timestamp":"2026-05-28T03:48:28.101Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.102Z","level":"info","module":"imageProcessor","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.109Z","level":"info","module":"imageProcessor","event":"image_processed","path":"ntaz\\AppData\\Local\\Temp\\test-unblind.png","sizeMB":"0.00","mimeType":"image/png"}
▶ imageProcessor
  ▶ validateFormat
    ✔ should accept jpg/png/gif/webp/bmp/svg (0.3782ms)
    ✔ should reject unsupported formats (0.0897ms)
  ✔ validateFormat (0.8607ms)
  ▶ processImage
    ✔ should encode a valid PNG to base64 data URL (2.666ms)
    ✔ should throw ClientError for non-existent file (0.5055ms)
    ✔ should throw ClientError for empty file (0.6453ms)
    ✔ should throw ClientError for unsupported format (0.6162ms)
  ✔ processImage (4.6345ms)
✔ imageProcessor (5.8029ms)
▶ logger
  ✔ should output valid JSON Lines to stderr (1.1707ms)
  ✔ should filter by log level (0.1228ms)
  ✔ should handle undefined data (0.0903ms)
✔ logger (1.9589ms)
{"timestamp":"2026-05-28T03:48:28.113Z","level":"info","module":"credentialManager","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.114Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.114Z","level":"info","module":"mimo","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.120Z","level":"info","module":"mimo","event":"api_call_start","model":"mimo-v2.5","mode":"describe"}
▶ MimoProvider
  ✔ should pass interface validation (0.5069ms)
  ✔ should have name 'mimo' (0.1002ms)
  ✔ should throw ClientError when API key is missing (0.4427ms)
{"timestamp":"2026-05-28T03:48:31.255Z","level":"info","module":"mimo","event":"api_call_success","model":"mimo-v2.5","mode":"describe","durationMs":3136}
{"timestamp":"2026-05-28T03:48:31.255Z","level":"info","module":"mimo","event":"api_call_start","model":"mimo-v2.5","mode":"describe"}
  ✔ healthCheck should return true with valid key (3135.9498ms)
{"timestamp":"2026-05-28T03:48:48.419Z","level":"info","module":"mimo","event":"api_call_success","model":"mimo-v2.5","mode":"describe","durationMs":17164}
  ✔ should return valid result for describe mode (17163.5961ms)
✔ MimoProvider (20301.4664ms)
{"timestamp":"2026-05-28T03:48:28.124Z","level":"info","module":"credentialManager","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.125Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.125Z","level":"info","module":"imageProcessor","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.125Z","level":"info","module":"retry","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.125Z","level":"info","module":"mimo","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.129Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:48:28.129Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:48:28.129Z","level":"info","module":"orchestrator","event":"processing_image","path":"/nonexistent/file.png","mode":"describe"}
{"timestamp":"2026-05-28T03:48:28.130Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:48:28.130Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:48:28.131Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:48:28.131Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:48:28.131Z","level":"info","module":"orchestrator","event":"processing_image","path":"\\Local\\Temp\\test-orch-real.png","mode":"describe"}
{"timestamp":"2026-05-28T03:48:28.132Z","level":"info","module":"imageProcessor","event":"image_processed","path":"az\\AppData\\Local\\Temp\\test-orch-real.png","sizeMB":"0.00","mimeType":"image/png"}
{"timestamp":"2026-05-28T03:48:28.132Z","level":"info","module":"orchestrator","event":"calling_provider","provider":"mimo","mode":"describe"}
{"timestamp":"2026-05-28T03:48:28.133Z","level":"info","module":"mimo","event":"api_call_start","model":"mimo-v2.5","mode":"describe"}
▶ orchestrator
  ✔ should reject non-existent file (1.128ms)
  ✔ should reject unsupported mode (0.9775ms)
{"timestamp":"2026-05-28T03:48:34.361Z","level":"info","module":"mimo","event":"api_call_success","model":"mimo-v2.5","mode":"describe","durationMs":6227}
{"timestamp":"2026-05-28T03:48:34.361Z","level":"info","module":"orchestrator","event":"analysis_complete","mode":"describe","durationMs":6227}
  ✔ should analyze a real image end-to-end (6230.1981ms)
✔ orchestrator (6232.965ms)
{"timestamp":"2026-05-28T03:48:28.123Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.124Z","level":"info","module":"retry","event":"module_loaded"}
{"timestamp":"2026-05-28T03:48:28.129Z","level":"warn","module":"retry","event":"attempt_failed","attempt":1,"maxAttempts":3,"error":"暂时不可用"}
▶ retry
  ✔ should return result on first success (1.0293ms)
{"timestamp":"2026-05-28T03:48:28.149Z","level":"warn","module":"retry","event":"attempt_failed","attempt":2,"maxAttempts":3,"error":"暂时不可用"}
{"timestamp":"2026-05-28T03:48:28.180Z","level":"warn","module":"retry","event":"attempt_failed","attempt":1,"maxAttempts":2,"error":"持续失败"}
  ✔ should retry on ServerError and eventually succeed (51.1023ms)
{"timestamp":"2026-05-28T03:48:28.196Z","level":"warn","module":"retry","event":"attempt_failed","attempt":2,"maxAttempts":2,"error":"持续失败"}
{"timestamp":"2026-05-28T03:48:28.197Z","level":"warn","module":"retry","event":"attempt_failed","attempt":1,"maxAttempts":3,"error":"fail"}
  ✔ should throw after max attempts (16.135ms)
  ✔ should NOT retry on ClientError (0.3358ms)
{"timestamp":"2026-05-28T03:48:28.210Z","level":"warn","module":"retry","event":"attempt_failed","attempt":2,"maxAttempts":3,"error":"fail"}
{"timestamp":"2026-05-28T03:48:28.226Z","level":"warn","module":"retry","event":"attempt_failed","attempt":3,"maxAttempts":3,"error":"fail"}
{"timestamp":"2026-05-28T03:48:28.226Z","level":"error","module":"retry","event":"circuit_open","failureCount":5,"timeoutSeconds":60}
  ✔ should use exponential backoff (29.5513ms)
  ▶ circuit breaker
    ✔ should start in CLOSED state (0.1682ms)
  ✔ circuit breaker (0.2527ms)
✔ retry (99.2121ms)
ℹ tests 40
ℹ suites 14
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 20421.9837

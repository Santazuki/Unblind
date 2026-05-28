{"timestamp":"2026-05-28T03:42:37.828Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:42:37.829Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:42:37.832Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:42:37.832Z","level":"info","module":"config","event":"loaded","model":"mimo-v2-omni","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:42:37.836Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:42:37.836Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
▶ config
  ✔ should return defaults when settings.json has no relevant fields (3.623ms)
  ✔ should read user-set values (2.2641ms)
  ✔ should warn when maxImageSize > 20MB (1.9141ms)
  ✔ should apply maxImageSize default if not set (1.8276ms)
✔ config (12.2809ms)
{"timestamp":"2026-05-28T03:42:37.824Z","level":"info","module":"credentialManager","event":"module_loaded"}
▶ credentialManager
  ▶ getBaseUrl
    ✔ should detect token-plan URL for tp- keys (1.2082ms)
    ✔ should detect api URL for sk- keys (0.0901ms)
    ✔ should return token-plan URL as default for unknown prefix (0.0706ms)
    ✔ should return empty string for empty key (0.0893ms)
  ✔ getBaseUrl (1.887ms)
  ▶ getApiKey
    ✔ should read from MIMO_API_KEY env (0.1468ms)
    ✔ should return empty string if not set (0.0888ms)
  ✔ getApiKey (0.316ms)
✔ credentialManager (2.4663ms)
{"timestamp":"2026-05-28T03:42:37.830Z","level":"info","module":"errorHandler","event":"module_loaded"}
▶ errorHandler
  ✔ ClientError should contain type, reason, suggestion (0.5154ms)
  ✔ ServerError should contain type and statusCode (0.1109ms)
  ✔ NetworkError should contain type (0.7245ms)
  ✔ formatError should produce Chinese user-facing message (0.1428ms)
✔ errorHandler (2.2895ms)
{"timestamp":"2026-05-28T03:42:37.837Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:42:37.838Z","level":"info","module":"imageProcessor","event":"module_loaded"}
{"timestamp":"2026-05-28T03:42:37.845Z","level":"info","module":"imageProcessor","event":"image_processed","path":"ntaz\\AppData\\Local\\Temp\\test-unblind.png","sizeMB":"0.00","mimeType":"image/png"}
▶ imageProcessor
  ▶ validateFormat
    ✔ should accept jpg/png/gif/webp/bmp/svg (0.3927ms)
    ✔ should reject unsupported formats (0.088ms)
  ✔ validateFormat (0.8852ms)
  ▶ processImage
    ✔ should encode a valid PNG to base64 data URL (2.4739ms)
    ✔ should throw ClientError for non-existent file (0.522ms)
    ✔ should throw ClientError for empty file (0.7126ms)
    ✔ should throw ClientError for unsupported format (0.6385ms)
  ✔ processImage (4.5625ms)
✔ imageProcessor (5.7245ms)
▶ logger
  ✔ should output valid JSON Lines to stderr (1.2381ms)
  ✔ should filter by log level (0.1266ms)
  ✔ should handle undefined data (0.0934ms)
✔ logger (2.0586ms)
{"timestamp":"2026-05-28T03:42:37.852Z","level":"info","module":"credentialManager","event":"module_loaded"}
{"timestamp":"2026-05-28T03:42:37.853Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:42:37.853Z","level":"info","module":"mimo","event":"module_loaded"}
{"timestamp":"2026-05-28T03:42:37.858Z","level":"info","module":"mimo","event":"api_call_start","model":"mimo-v2.5","mode":"describe"}
▶ MimoProvider
  ✔ should pass interface validation (0.4502ms)
  ✔ should have name 'mimo' (0.0913ms)
  ✔ should throw ClientError when API key is missing (0.4391ms)
{"timestamp":"2026-05-28T03:42:39.808Z","level":"info","module":"mimo","event":"api_call_success","model":"mimo-v2.5","mode":"describe","durationMs":1950}
{"timestamp":"2026-05-28T03:42:39.809Z","level":"info","module":"mimo","event":"api_call_start","model":"mimo-v2.5","mode":"describe"}
  ✔ healthCheck should return true with valid key (1950.4403ms)
{"timestamp":"2026-05-28T03:42:54.496Z","level":"info","module":"mimo","event":"api_call_success","model":"mimo-v2.5","mode":"describe","durationMs":14687}
  ✔ should return valid result for describe mode (14688.1547ms)
✔ MimoProvider (16640.5975ms)
{"timestamp":"2026-05-28T03:42:37.856Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:42:37.856Z","level":"info","module":"retry","event":"module_loaded"}
{"timestamp":"2026-05-28T03:42:37.861Z","level":"warn","module":"retry","event":"attempt_failed","attempt":1,"maxAttempts":3,"error":"暂时不可用"}
▶ retry
  ✔ should return result on first success (1.245ms)
{"timestamp":"2026-05-28T03:42:37.871Z","level":"warn","module":"retry","event":"attempt_failed","attempt":2,"maxAttempts":3,"error":"暂时不可用"}
{"timestamp":"2026-05-28T03:42:37.902Z","level":"warn","module":"retry","event":"attempt_failed","attempt":1,"maxAttempts":2,"error":"持续失败"}
  ✔ should retry on ServerError and eventually succeed (40.4344ms)
{"timestamp":"2026-05-28T03:42:37.917Z","level":"warn","module":"retry","event":"attempt_failed","attempt":2,"maxAttempts":2,"error":"持续失败"}
{"timestamp":"2026-05-28T03:42:37.917Z","level":"warn","module":"retry","event":"attempt_failed","attempt":1,"maxAttempts":3,"error":"fail"}
  ✔ should throw after max attempts (15.4217ms)
  ✔ should NOT retry on ClientError (0.2182ms)
{"timestamp":"2026-05-28T03:42:37.932Z","level":"warn","module":"retry","event":"attempt_failed","attempt":2,"maxAttempts":3,"error":"fail"}
{"timestamp":"2026-05-28T03:42:37.948Z","level":"warn","module":"retry","event":"attempt_failed","attempt":3,"maxAttempts":3,"error":"fail"}
{"timestamp":"2026-05-28T03:42:37.948Z","level":"error","module":"retry","event":"circuit_open","failureCount":5,"timeoutSeconds":60}
  ✔ should use exponential backoff (30.3365ms)
  ▶ circuit breaker
    ✔ should start in CLOSED state (0.1539ms)
  ✔ circuit breaker (0.2465ms)
✔ retry (88.6659ms)
ℹ tests 34
ℹ suites 12
ℹ pass 34
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 16760.9132

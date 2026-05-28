{"timestamp":"2026-05-28T03:40:32.186Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:40:32.187Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:40:32.189Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:40:32.189Z","level":"info","module":"config","event":"loaded","model":"mimo-v2-omni","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:40:32.193Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:40:32.193Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
▶ config
  ✔ should return defaults when settings.json has no relevant fields (3.5334ms)
  ✔ should read user-set values (1.8949ms)
  ✔ should warn when maxImageSize > 20MB (1.8949ms)
  ✔ should apply maxImageSize default if not set (1.8852ms)
✔ config (11.3592ms)
{"timestamp":"2026-05-28T03:40:32.183Z","level":"info","module":"credentialManager","event":"module_loaded"}
▶ credentialManager
  ▶ getBaseUrl
    ✔ should detect token-plan URL for tp- keys (1.4062ms)
    ✔ should detect api URL for sk- keys (0.1013ms)
    ✔ should return token-plan URL as default for unknown prefix (0.0746ms)
    ✔ should return empty string for empty key (0.0964ms)
  ✔ getBaseUrl (2.1605ms)
  ▶ getApiKey
    ✔ should read from MIMO_API_KEY env (0.1527ms)
    ✔ should return empty string if not set (0.089ms)
  ✔ getApiKey (0.3287ms)
✔ credentialManager (2.8563ms)
{"timestamp":"2026-05-28T03:40:32.188Z","level":"info","module":"errorHandler","event":"module_loaded"}
▶ errorHandler
  ✔ ClientError should contain type, reason, suggestion (0.662ms)
  ✔ ServerError should contain type and statusCode (0.1593ms)
  ✔ NetworkError should contain type (0.8502ms)
  ✔ formatError should produce Chinese user-facing message (0.1371ms)
✔ errorHandler (2.5614ms)
{"timestamp":"2026-05-28T03:40:32.194Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:40:32.195Z","level":"info","module":"imageProcessor","event":"module_loaded"}
{"timestamp":"2026-05-28T03:40:32.202Z","level":"info","module":"imageProcessor","event":"image_processed","path":"ntaz\\AppData\\Local\\Temp\\test-unblind.png","sizeMB":"0.00","mimeType":"image/png"}
▶ imageProcessor
  ▶ validateFormat
    ✔ should accept jpg/png/gif/webp/bmp/svg (0.4077ms)
    ✔ should reject unsupported formats (0.2209ms)
  ✔ validateFormat (1.1578ms)
  ▶ processImage
    ✔ should encode a valid PNG to base64 data URL (2.438ms)
    ✔ should throw ClientError for non-existent file (0.521ms)
    ✔ should throw ClientError for empty file (0.634ms)
    ✔ should throw ClientError for unsupported format (0.6207ms)
  ✔ processImage (4.4146ms)
✔ imageProcessor (5.8766ms)
▶ logger
  ✔ should output valid JSON Lines to stderr (1.1791ms)
  ✔ should filter by log level (0.1084ms)
  ✔ should handle undefined data (0.0879ms)
✔ logger (1.9361ms)
{"timestamp":"2026-05-28T03:40:32.209Z","level":"info","module":"errorHandler","event":"module_loaded"}
{"timestamp":"2026-05-28T03:40:32.209Z","level":"info","module":"retry","event":"module_loaded"}
{"timestamp":"2026-05-28T03:40:32.215Z","level":"warn","module":"retry","event":"attempt_failed","attempt":1,"maxAttempts":3,"error":"暂时不可用"}
▶ retry
  ✔ should return result on first success (1.2823ms)
{"timestamp":"2026-05-28T03:40:32.239Z","level":"warn","module":"retry","event":"attempt_failed","attempt":2,"maxAttempts":3,"error":"暂时不可用"}
{"timestamp":"2026-05-28T03:40:32.271Z","level":"warn","module":"retry","event":"attempt_failed","attempt":1,"maxAttempts":2,"error":"持续失败"}
  ✔ should retry on ServerError and eventually succeed (55.3136ms)
{"timestamp":"2026-05-28T03:40:32.285Z","level":"warn","module":"retry","event":"attempt_failed","attempt":2,"maxAttempts":2,"error":"持续失败"}
{"timestamp":"2026-05-28T03:40:32.287Z","level":"warn","module":"retry","event":"attempt_failed","attempt":1,"maxAttempts":3,"error":"fail"}
  ✔ should throw after max attempts (15.7008ms)
  ✔ should NOT retry on ClientError (0.4707ms)
{"timestamp":"2026-05-28T03:40:32.287Z","level":"warn","module":"retry","event":"attempt_failed","attempt":2,"maxAttempts":3,"error":"fail"}
{"timestamp":"2026-05-28T03:40:32.300Z","level":"warn","module":"retry","event":"attempt_failed","attempt":3,"maxAttempts":3,"error":"fail"}
{"timestamp":"2026-05-28T03:40:32.300Z","level":"error","module":"retry","event":"circuit_open","failureCount":5,"timeoutSeconds":60}
  ✔ should use exponential backoff (14.0908ms)
  ▶ circuit breaker
    ✔ should start in CLOSED state (0.1986ms)
  ✔ circuit breaker (0.3187ms)
✔ retry (88.153ms)
ℹ tests 29
ℹ suites 11
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 179.5399

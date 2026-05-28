{"timestamp":"2026-05-28T03:34:58.018Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:34:58.019Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:34:58.022Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:34:58.022Z","level":"info","module":"config","event":"loaded","model":"mimo-v2-omni","maxImageSizeMB":"50.0"}
{"timestamp":"2026-05-28T03:34:58.025Z","level":"warn","module":"config","event":"large_max_image_size","maxImageSizeMB":"50","advisory":"大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升"}
⚠️ 性能提示：当前图片大小上限 50MB，超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。
{"timestamp":"2026-05-28T03:34:58.025Z","level":"info","module":"config","event":"loaded","model":"mimo-v2.5","maxImageSizeMB":"50.0"}
▶ config
  ✔ should return defaults when settings.json has no relevant fields (2.8565ms)
  ✔ should read user-set values (2.2889ms)
  ✔ should warn when maxImageSize > 20MB (1.4862ms)
  ✔ should apply maxImageSize default if not set (1.348ms)
✔ config (9.9061ms)
{"timestamp":"2026-05-28T03:34:58.021Z","level":"info","module":"errorHandler","event":"module_loaded"}
▶ errorHandler
  ✔ ClientError should contain type, reason, suggestion (0.4626ms)
  ✔ ServerError should contain type and statusCode (0.1008ms)
  ✔ NetworkError should contain type (0.6808ms)
  ✔ formatError should produce Chinese user-facing message (0.1394ms)
✔ errorHandler (1.9621ms)
▶ logger
  ✔ should output valid JSON Lines to stderr (1.2681ms)
  ✔ should filter by log level (0.1235ms)
  ✔ should handle undefined data (0.0932ms)
✔ logger (2.0651ms)
ℹ tests 11
ℹ suites 3
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 72.7701

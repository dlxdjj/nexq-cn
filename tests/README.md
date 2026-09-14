# 中文版测试

测试使用虚构会议文本和固定合成语音，不需要导入个人会议资料。普通逻辑与浏览器模拟测试不调用 OpenAI；真实服务探针必须明确启用，可能收费。

## 前端逻辑和构建

在仓库根目录执行：

```powershell
npm ci
npm run test:cn
npm run build
```

## 浏览器模拟

可选测试依赖 Playwright 不属于应用运行依赖。使用自己的 Playwright 安装，或临时安装并保持锁文件不变：

```powershell
npm install --no-save --package-lock=false playwright
# 终端一：仅监听本机
npm run dev -- --host 127.0.0.1 --port 5178 --strictPort
# 终端二：逐项运行
node tests/cn-ui.test.cjs
node tests/cn-settings.test.cjs
node tests/cn-windows.test.cjs
node tests/cn-speech-turns.test.cjs
```

Windows 默认使用已安装的 Edge。其他平台默认使用 Playwright Chromium，需先 `npx playwright install chromium`。可通过 `NEXQ_BROWSER_EXECUTABLE` 指定浏览器，或 `NEXQ_PLAYWRIGHT_MODULE` 指定已有 Playwright 模块目录。截图位于被 Git 忽略的 `test-results/`。

这些测试模拟 Tauri IPC 和模型返回，验证界面、事件、话轮和翻译行为；不是实际 Teams 通话或语音准确率测评。

## Windows 原生离线逻辑测试

准备 Rust MSVC、C++ Build Tools、Windows SDK、CMake、LLVM/libclang、Node.js。进入已初始化的 x64 Visual Studio 开发者终端，或通过 `-VcVarsPath` 指定自己的 `vcvars64.bat`。`cargo`、`node`、`mt.exe` 需要可用；`LIBCLANG_PATH`、`CARGO_TARGET_DIR` 等标准环境变量按本机情况设置，脚本不会覆盖用户工具链目录。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-cn.ps1 -Action test
# 依赖缓存完整时可离线编译
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-cn.ps1 -Action test -Offline
# 同一环境构建安装包
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-cn.ps1 -Action build
```

测试脚本为原生测试程序嵌入 Common Controls manifest；若 release 目录包含 DirectML.dll，会将它复制至测试程序目录，避免误加载旧系统 DLL。新机器仍需安装、下载原生构建依赖。

## 真实服务探针：显式操作，可能收费

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-cn.ps1 -Action probe -AllowNetworkProbes
```

只使用固定问题和 `src-tauri/fixtures/stt-probe.wav`，凭据由应用模块读取，不输出密钥。不要在未获得账户持有人许可时运行。该测试不会启动 Teams 或采集麦克风。

`native-startup-check.cjs` 与 `native-service-probe.cjs` 是人工原生验收辅助脚本，仅连接临时开放的本机 WebView2 调试端口 `9335`。服务探针还要求 `NEXQ_ALLOW_NETWORK_PROBES=1`。正常使用不要开放这个端口；验收结束应关闭调试实例并正常重启应用。启动脚本只显示窗口和读取版本，不再保存应用设置。

## 已有验收记录

2026-09-14，cn4 通过 70 项 Rust 单元测试、10 项前端逻辑测试、4 组模拟浏览器测试与生产构建。2 个默认跳过的真实服务测试函数经显式运行通过，包含 3 个固定文本问题和 1 个合成语音请求。此结果不承诺未知设备、网络环境或未来模型返回均通过。

GitHub 整理时另行移除了开发机绝对路径、整理截图目录，并给收费探针增加显式开关。这些是测试与发布工具整理，不改变已构建 cn4 的应用功能。

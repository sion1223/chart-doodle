import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  // 앱인토스 콘솔에 등록한 앱 이름(appName)과 같아야 업로드돼요.
  appName: "chart-doodle",
  brand: {
    primaryColor: "#6A2BE8",
  },
  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
    withTitle: true,
    theme: "light",
  },
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: "never",
  },
  permissions: [],
  webBundleDir: "dist",
});

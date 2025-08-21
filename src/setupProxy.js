const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/hackathon",
    createProxyMiddleware({
      target: "http://3.27.150.124:8080", // 또는 여러분의 백엔드
      changeOrigin: true,
      ws: true,
      proxyTimeout: 120000,
      timeout: 120000,
    })
  );
};

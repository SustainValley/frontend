// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // REST API
  app.use(
    ["/hackathon", "/hackathon/api"],
    createProxyMiddleware({
      target: "http://3.27.150.124:8080",
      changeOrigin: true,
      secure: false,
    })
  );

  // WS-STOMP 엔드포인트만 정확히 지정 (★ /ws 나 /sockjs-node 넣지 말기)
  app.use(
    "/hackathon/api/ws-stomp",
    createProxyMiddleware({
      target: "http://3.27.150.124:8080",
      changeOrigin: true,
      ws: true,        // 업그레이드 허용
      secure: false,
    })
  );
};

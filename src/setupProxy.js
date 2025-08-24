const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    ["/hackathon", "/hackathon/api"],
    createProxyMiddleware({
      target: "http://3.27.150.124:8080",
      changeOrigin: true,
      secure: false,
    })
  );

  app.use(
    "/hackathon/api/ws-stomp",
    createProxyMiddleware({
      target: "http://3.27.150.124:8080",
      changeOrigin: true,
      ws: true,      
      secure: false,
    })
  );
};

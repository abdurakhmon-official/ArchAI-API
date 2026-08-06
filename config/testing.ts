export default {
  // Honours PORT so the integration suite can start the API on its own port
  // without colliding with a running `yarn dev`.
  port: Number(process.env.PORT) || 3000,
  logging: false,
};

export default {
  apps: [{
    name: "brindi-bot",
    script: "index.js",
    watch: true,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
    },
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    autorestart: true,
    restart_delay: 5000
  }]
}
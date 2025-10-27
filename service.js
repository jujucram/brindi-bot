const pm2 = require('pm2');

pm2.connect(function(err) {
  if (err) {
    console.error(err);
    process.exit(2);
  }
  
  pm2.start({
    script    : 'index.js',
    name      : 'brindi-bot',
    exec_mode : 'fork',
    max_memory_restart : '500M',
    exp_backoff_restart_delay : 100,
    watch     : true,
    ignore_watch : ["node_modules", "brindi_auth", "downloads"],
    env: {
      NODE_ENV: "production"
    }
  }, function(err, apps) {
    pm2.disconnect();
    if (err) throw err;
  });
});
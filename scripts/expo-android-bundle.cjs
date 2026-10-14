const fs = require('node:fs');
const path = require('node:path');

// Native compilation uses SUBST. Metro must use the physical workspace, because
// npm's workspace junctions and Metro's file hashes are canonicalized to C:.
const mappedRoot = process.env.WELDCOSTA_ANDROID_BUILD_ROOT;
const workspace = fs.realpathSync.native(path.resolve(__dirname, '..'));
if (mappedRoot) {
  const prefix = mappedRoot.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
  process.argv = process.argv.map((argument) => {
    const normalized = argument.replace(/\\/g, '/');
    return normalized.toLowerCase().startsWith(prefix.toLowerCase())
      ? path.join(workspace, normalized.slice(prefix.length))
      : argument;
  });
}
process.chdir(fs.realpathSync.native(process.cwd()));
const cli = path.join(workspace, 'node_modules/expo/bin/cli');
process.argv[1] = cli;
require(cli);

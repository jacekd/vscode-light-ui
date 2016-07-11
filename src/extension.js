var vscode = require('vscode');
var fs = require('fs');
var request = require('request');
var extract = require('extract-zip');
var path = require('path');
var events = require('events');
var msg = require('./messages').messages;

function activate(context) {

	console.log('vscode-customcss is active!');

	process.on('uncaughtException', function (err) {
		if (/ENOENT|EACCES|EPERM/.test(err.code)) {
			vscode.window.showInformationMessage(msg.admin);
			return;
		}
	});

	var eventEmitter = new events.EventEmitter();
	var isWin = /^win/.test(process.platform);
	var appDir = path.dirname(require.main.filename);

	var base = appDir + (isWin ? '\\vs\\workbench' : '/vs/workbench');
	var iconFolder = base + (isWin ? '\\parts\\files\\browser\\media' : '/parts/files/browser/media');

	var cssfile = base + (isWin ? '\\workbench.main.css' : '/workbench.main.css');
	var cssfilebak = base + (isWin ? '\\workbench.main.css.bak-customcss' : '/workbench.main.css.bak-customcss');

	function replaceCss() {
		var config = vscode.workspace.getConfiguration("vscode_custom_css");
		console.log(config);
		if (!config) {
			vscode.window.showInformationMessage(msg.notconfigured);
			console.log(msg.notconfigured);
			fUninstall();
			return;
		};
		var filePath = config.file;
		if (!filePath) {
			vscode.window.showInformationMessage(msg.notconfigured);
			console.log(msg.notconfigured);
			return;
		};
		fs.stat(filePath, function (err, result) {
			if (err) {
				vscode.window.showInformationMessage(msg.notfound);
				fUninstall();
				return;
			}
			try {
				var css = fs.readFileSync(cssfile, 'utf-8');
				css += '\n\n/* !!! VSCODE-CUSTOM-CSS-REPLACEMENTS BEGIN !!! */\n';
				css += fs.readFileSync(filePath, 'utf-8');
				css += '\n\n/* !!! VSCODE-CUSTOM-CSS-REPLACEMENTS END !!! */\n';
				fs.writeFileSync(cssfile, css, 'utf-8');
				enabledRestart();
			} catch (err) {
				if (err) { console.log(err); }
			}
		});
	}

	function timeDiff(d1, d2) {
		var timeDiff = Math.abs(d2.getTime() - d1.getTime());
		return timeDiff;
	}

	function hasBeenUpdated(stats1, stats2) {
		var dbak = new Date(stats1.ctime);
		var dor = new Date(stats2.ctime);
		var segs = timeDiff(dbak, dor) / 1000;
		return segs > 60;
	}

	function cleanCssInstall() {
		var c = fs.createReadStream(cssfile).pipe(fs.createWriteStream(cssfilebak));
		c.on('finish', function () {
			replaceCss();
		});
	}

	function installItem(bakfile, orfile, cleanInstallFunc) {
		fs.stat(bakfile, function (errBak, statsBak) {
			if (errBak) {
				// clean installation
				cleanInstallFunc();
			} else {
				// check cssfilebak's timestamp and compare it to the cssfile's.
				fs.stat(orfile, function (errOr, statsOr) {
					if (errOr) {
						vscode.window.showInformationMessage(msg.smthingwrong + errOr);
					} else {
						var updated = hasBeenUpdated(statsBak, statsOr);
						if (updated) {
							// some update has occurred. clean install
							cleanInstallFunc();
						}
					}
				});
			}
		});
	}

	function emitEndUninstall() {
		eventEmitter.emit('endUninstall');
	}

	function restoredAction(isRestored, willReinstall) {
		if (isRestored >= 1) {
			if (willReinstall) {
				emitEndUninstall();
			} else {
				disabledRestart();
			}
		}
	}

	function restoreBak(willReinstall) {
		var restore = 0;
		fs.unlink(cssfile, function (err) {
			if (err) {
				vscode.window.showInformationMessage(msg.admin);
				return;
			}
			var c = fs.createReadStream(cssfilebak).pipe(fs.createWriteStream(cssfile));
			c.on('finish', function () {
				fs.unlink(cssfilebak);
				restore++;
				restoredAction(restore, willReinstall);
			});
		});
	}

	function reloadWindow() {
		// reload vscode-window
		vscode.commands.executeCommand("workbench.action.reloadWindow");
	}

	function enabledRestart() {
		vscode.window.showInformationMessage(msg.enabled, { title: msg.restartIde })
			.then(function (msg) {
				reloadWindow();
			});
	}
	function disabledRestart() {
		vscode.window.showInformationMessage(msg.disabled, { title: msg.restartIde })
			.then(function (msg) {
				reloadWindow();
			});
	}

	// ####  main commands ######################################################

	function fInstall() {
		installItem(cssfilebak, cssfile, cleanCssInstall);
	}

	function fUninstall(willReinstall) {
		fs.stat(cssfilebak, function (errBak, statsBak) {
			if (errBak) { return; }
			fs.stat(cssfile, function (errOr, statsOr) {
				if (errOr) {
					vscode.window.showInformationMessage(msg.smthingwrong + errOr);
				} else {
					// restoring bak files
					restoreBak(willReinstall);
				}
			});
		});
	}

	var installCustomCSS = vscode.commands.registerCommand('extension.installCustomCSS', fInstall);
	var uninstallCustomCSS = vscode.commands.registerCommand('extension.uninstallCustomCSS', fUninstall);

	context.subscriptions.push(installCustomCSS);
	context.subscriptions.push(uninstallCustomCSS);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
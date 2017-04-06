
//
// ─── IMPORTS ────────────────────────────────────────────────────────────────────
//

	var vscode 	= require( 'vscode' )
	var fs 		= require( 'fs' )
	var request = require( 'request' )
	var extract = require( 'extract-zip' )
	var path 	= require( 'path' )
	var events 	= require( 'events' )
	var msg 	= require( './messages' ).messages

//
// ─── CONSTANTS ──────────────────────────────────────────────────────────────────
//


	const assetFiles = [
		path.resolve( `${ __dirname }/../assets/theme.css` )
	]

//
// ─── ACTIVATION FUNCTION ────────────────────────────────────────────────────────
//


	function activate( context ) {

		//
		// ─── ON PROCESS ──────────────────────────────────────────────────
		//

			process.on( 'uncaughtException', function ( err ) {
				if ( /ENOENT|EACCES|EPERM/.test( err.code ) ) {
					vscode.window.showInformationMessage( msg.admin )
					return
				}
			})

		//
		// ─── INFO ────────────────────────────────────────────────────────
		//

			var eventEmitter 	= new events.EventEmitter( )
			var isWin 			= /^win/.test( process.platform )
			var appDir 			= path.dirname( require.main.filename )

			var base = appDir + ( isWin 
				? '\\vs\\workbench'
				: '/vs/workbench' )

			var htmlFile = base + ( isWin 
				?'\\electron-browser\\bootstrap\\index.html'
				: '/electron-browser/bootstrap/index.html' )
			var htmlFileBack = base + ( isWin
				? '\\electron-browser\\bootstrap\\index.html.bak-customcss'
				: '/electron-browser/bootstrap/index.bak-customcss' )

		//
		// ─── CSS REPLACER FUNCTION ───────────────────────────────────────
		//

			function replaceCss ( ) {
				var injectHTML = assetFiles.map( function ( x ) {
					if ( !x ) return
					if ( typeof x === 'string' ) {
						if ( /\.js$/.test( x ) )
							return `<script src="${ x }"></script>`
						if ( /\.css$/.test( x ) )
							return `<link rel="stylesheet" type="text/css" href="${ x }"/>`
					}
				}).join('')

				try {
					var html = fs.readFileSync( htmlFile, 'utf-8' )
					html = html.replace(
						/<!-- !! VSCODE-CUSTOM-CSS-START !! -->[\s\S]*?<!-- !! VSCODE-CUSTOM-CSS-END !! -->/,
						'' )
					html = html.replace( /(<\/html>)/,
						'<!-- !! VSCODE-CUSTOM-CSS-START !! -->'
						+ injectHTML + '<!-- !! VSCODE-CUSTOM-CSS-END !! --></html>' )
			
					fs.writeFileSync( htmlFile, html, 'utf-8' )
					enabledRestart( )
		
				} catch ( e ) {
					console.error( e )
				}
			}

		//
		// ─── TIME DIFFERENCE ─────────────────────────────────────────────
		//

			function timeDiff ( d1, d2 ) {
				return Math.abs( d2.getTime( ) - d1.getTime( ) )
			}

		//
		// ─── HAS BEEN UPDATED ────────────────────────────────────────────
		//

			function hasBeenUpdated ( stats1, stats2 ) {
				var dbak 	= new Date( stats1.ctime )
				var dor 	= new Date( stats2.ctime )
				var segs 	= timeDiff( dbak, dor ) / 1000
				return segs > 60;
			}

		//
		// ─── CLEAN CSS INSTALL ───────────────────────────────────────────
		//

			function cleanCssInstall ( ) {
				var c = fs.createReadStream( htmlFile )
						.pipe( fs.createWriteStream( htmlFileBack ) )

				c.on( 'finish', function ( ) {
					replaceCss( )
				})
			}

		//
		// ─── INSTALL ITEM ────────────────────────────────────────────────
		//

		function installItem ( bakfile, orfile, cleanInstallFunc ) {
			fs.stat( bakfile, function ( errBak, statsBak ) {
				if ( errBak ) {
					// clean installation
					cleanInstallFunc( )

				} else {
					// check htmlFileBack's timestamp and compare it to the htmlFile's.
					fs.stat( orfile, function ( errOr, statsOr ) {
						if ( errOr ) {
							vscode.window.showInformationMessage( msg.smthingwrong + errOr )

						} else {
							var updated = hasBeenUpdated( statsBak, statsOr )
							if ( updated ) {
								// some update has occurred. clean install
								cleanInstallFunc( )
							}
						}
					})
				}
			})
		}

		//
		// ─── EMIT END UNINSTALL ──────────────────────────────────────────
		//

			function emitEndUninstall ( ) {
				eventEmitter.emit( 'endUninstall' )
			}

		//
		// ─── RESTORED ACTION ─────────────────────────────────────────────
		//

			function restoredAction( isRestored, willReinstall ) {
				if ( isRestored >= 1 ) {
					if ( willReinstall ) {
						emitEndUninstall( )
					} else {
						disabledRestart( )
					}
				}
			}

		//
		// ─── RESTORE BAK ─────────────────────────────────────────────────
		//

			function restoreBak( willReinstall ) {
				var restore = 0
				fs.unlink( htmlFile, function ( err ) {
					if ( err ) {
						vscode.window.showInformationMessage( msg.admin )
						return
					}

					var c = fs.createReadStream( htmlFileBack )
								.pipe( fs.createWriteStream( htmlFile ) )

					c.on( 'finish', function ( ) {
						fs.unlink( htmlFileBack )
						restore++
						restoredAction( restore, willReinstall )
					})
				})
			}

		//
		// ─── RELOAD WINDOW ───────────────────────────────────────────────
		//

			function reloadWindow ( ) {
				// reload vscode-window
				vscode.commands.executeCommand( "workbench.action.reloadWindow" )
			}

		//
		// ─── ENABLE RESTART ──────────────────────────────────────────────
		//

			function enabledRestart() {
				vscode.window.showInformationMessage( msg.enabled, { title: msg.restartIde } )
					.then( function ( msg ) {
						reloadWindow( )
					}
				)
			}

		//
		// ─── DISABLE RESTART ─────────────────────────────────────────────
		//

			function disabledRestart ( ) {
				vscode.window.showInformationMessage( msg.disabled, { title: msg.restartIde })
					.then( function ( msg ) {
						reloadWindow( )
					}
				)
			}

		//
		// ─── FILE INSTALL ────────────────────────────────────────────────
		//

			function fInstall ( ) {
				installItem( htmlFileBack, htmlFile, cleanCssInstall )
			}

		//
		// ─── FILE UNINSTALL ──────────────────────────────────────────────
		//

			function fUninstall ( willReinstall ) {
				fs.stat( htmlFileBack, function ( errBak, statsBak ) {
					if ( errBak ) {
						if ( willReinstall ) {
							emitEndUninstall( )
						}
						return
					}

					fs.stat( htmlFile, function ( errOr, statsOr ) {
						if ( errOr ) {
							vscode.window.showInformationMessage( msg.smthingwrong + errOr )
						} else {
							restoreBak( willReinstall )
						}
					})
				})
			}

		//
		// ─── FILE UPDATE ─────────────────────────────────────────────────
		//

			function fUpdate ( ) {
				eventEmitter.once( 'endUninstall', fInstall )
				fUninstall( true )
			}

		//
		// ─── SUBSCRIBING ─────────────────────────────────────────────────
		//

			var installCustomCSS = vscode.commands.registerCommand(
				'extension.installCustomCSS', fInstall )

			var uninstallCustomCSS = vscode.commands.registerCommand(
				'extension.uninstallCustomCSS', fUninstall )

			var updateCustomCSS = vscode.commands.registerCommand(
				'extension.updateCustomCSS', fUpdate )

			context.subscriptions.push( installCustomCSS )
			context.subscriptions.push( uninstallCustomCSS )
			context.subscriptions.push( updateCustomCSS )

		
	}

	// important part!
	exports.activate = activate;

//
// ─── ON DONE ────────────────────────────────────────────────────────────────────
//


	// this method is called when your extension is deactivated
	function deactivate ( ) {

	}
	exports.deactivate = deactivate

// ────────────────────────────────────────────────────────────────────────────────


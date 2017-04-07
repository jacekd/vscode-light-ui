
//
// Copyright 2017-present Kary Foundation, Inc. All Rights Reserved.
//   Author: Pouya Kary <k@karyfoundation.org>
//

//
// ─── IMPORTS ────────────────────────────────────────────────────────────────────
//


    fix vscode  = (require "vscode")
    fix fs      = (require "fs")
    fix request = (require "request")
    fix extract = (require "extract-zip")
    fix path    = (require "path")
    fix events  = (require "events")
    fix msg     = (require "./messages")/messages

//
// ─── CONSTANTS ──────────────────────────────────────────────────────────────────
//

    array objectFiles:
       (path/resolve (sum --dirname "/../assets/theme.css" ))
    end

//
// ─── MAIN ───────────────────────────────────────────────────────────────────────
//

    def activate context:

        //
        // ─── PROCESS ON ──────────────────────────────────────────────────
        //

            @process-on-body = to err do
                fix regX = /ENOENT|EACCES|EPERM/
                if (regX/test err/code ):
                    (vscode/window/showInformationMessage msg/admin)
                end
            end
            (process/on 'uncaughtException' @process-on-body)

        //
        // ─── INFO ────────────────────────────────────────────────────────
        //

        	mut event-emitter 	= new (events/EventEmitter)
            fix is-win-reg-x    = /^win/
			mut is-win 			= (is-win-reg-x/test process/platform)
			mut app-dir 		= (path/dirname require/main/filename)

        //
        // ─── OS VARS ─────────────────────────────────────────────────────
        //

            def get-win win-part unix-part:
                if is-win:
                    return win-part
                else
                    return unix-part
                end
            end

        	mut base = (sum
                app-dir
                (get-win
                    '\\vs\\workbench'
                    '/vs/workbench'))

            mut html-file = (sum
                base
                (get-win 
                    '\\electron-browser\\bootstrap\\index.html'
                    '/electron-browser/bootstrap/index.html'))

            mut html-file-back = (sum
                base
                (get-win
                    '\\electron-browser\\bootstrap\\index.html.bak-customcss'
                    '/electron-browser/bootstrap/index.bak-customcss'))

        //
        // ─── REPLACE CSS ─────────────────────────────────────────────────
        //

            def replace-css:
                fix is-js   = /\.js$/
                fix is-css  = /\.css$/

                def html-mapper-function x:
					if (not x):
                        return
                    end

					if (typeof x) == 'string':
						if (is-js/test x):
							return (sum '<script src=' x '></script>')
                        end

						if (is-css/test x):
							return (sum
                                '<link rel="stylesheet" type="text/css" href="' x '"/>')
                        end
					end
                end

                mut inject-html = (assetFiles/map mapper-function)
                inject-html /= (join '')

                try
                    mut html = (fs/readFileSync html-file 'utf-8')
                    html /= (replace
                        new (RegExp '<!-- !! VSCODE-CUSTOM-CSS-START !! -->[\s\S]*?<!-- !! VSCODE-CUSTOM-CSS-END !! -->')
                        '')

                    html /= (replace
                        new (RegExp '(</html>)')
						(sum
                            '<!-- !! VSCODE-CUSTOM-CSS-START !! -->'
						    inject-html
                            '<!-- !! VSCODE-CUSTOM-CSS-END !! --></html>'
                        ))

                    (fs/writeFileSync html-file html 'utf-8')
                    (enable-restart)

                catch e:
                    (console/error e)
                end
            end

        //
        // ─── TIME DIFFERENCE ─────────────────────────────────────────────
        //

            def time-diff d1 d2:
               return (Math/abs (sub
                            (d2/getTime)
                            (d1/getTime)))
            end

        //
        // ─── HAS BEEN UPDATED ────────────────────────────────────────────
        //

            def has-been-updated stats-1 stats-2:
                fix backup-date     = new (Date stats-1/ctime)
                fix original-date   = new (Date stats-2/ctime)
                fix segs            = (div (time-diff backup-date, original-date)
                                        1000)
                return segs > 60
            end

        //
        // ─── CLEAN CSS INSTALL ───────────────────────────────────────────
        //

            def clean-css-install:
                mut c = (fs/createReadStream html-file)
                c /= (pipe (fs/createWriteStream html-file-back))

                (c/on 'finish' replace-css)
            end

        //
        // ─── INSTALL ITEM ────────────────────────────────────────────────
        //

            def install-item back-file  original-file  clean-install-function:
                (fs/stats back-file to error-back, stats-back do
                    if error-back:
                        (clean-install-function)
                    else
                        (fs/stat original-file to error-original, stats-original do
                            if error-original:
                                (vscode/window/showInformationMessage (sum
                                    msg/smthingwrong
                                    error-original
                                ))
                            else
                                mut updated = (has-been-updated stats-backup stats-original)
                                if updated:
                                    (clean-install-function)
                                end
                            end
                        end)
                    end
                end)
            end



    end
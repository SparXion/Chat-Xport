import SwiftUI

@main
struct GrokChatSaverApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands {
            CommandGroup(after: .appInfo) {
                Button("Open Extension Preferences…") {
                    SSPreferencesOpener.open()
                }
                .keyboardShortcut(",", modifiers: .command)
            }
        }
    }
}//
//  GrotChatSaverApp.swift
//  Grok Chat Saver
//
//  Created by John Violette on 11/9/25.
//


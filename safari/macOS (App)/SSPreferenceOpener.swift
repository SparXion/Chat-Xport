import SafariServices
import AppKit

enum SSPreferencesOpener {
    static func open() {
        let extensionIdentifier = "sparxion.com.Chat-Xport.Extension"
        
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionIdentifier) { error in
            if let error {
                NSLog("Unable to open Safari preferences: %@", error.localizedDescription)
                
                // Fallback: Open Safari and show alert with instructions
                DispatchQueue.main.async {
                    // Try to open Safari first
                    if let safariURL = URL(string: "x-safari-https://") {
                        NSWorkspace.shared.open(safariURL)
                    }
                    
                    // Show alert with instructions
                    let alert = NSAlert()
                    alert.messageText = "Unable to Open Safari Preferences"
                    alert.informativeText = "Please manually enable the extension:\n\n1. Open Safari\n2. Go to Safari → Settings (or Preferences)\n3. Click the Extensions tab\n4. Find 'SparXion Chat Xport' and enable it"
                    alert.alertStyle = .informational
                    alert.addButton(withTitle: "OK")
                    alert.runModal()
                }
            }
        }
    }
}//
//  SSPreferenceOpener.swift
//  Grok Chat Saver
//
//  Created by John Violette on 11/9/25.
//


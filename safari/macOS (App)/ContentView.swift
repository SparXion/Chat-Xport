import SwiftUI
import SafariServices

struct ContentView: View {
    @State private var extensionEnabled = false

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "tray.and.arrow.down.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 72, height: 72)
                .foregroundColor(.accentColor)

            Text("SparXion Chat Xport")
                .font(.title)
                .fontWeight(.semibold)

            VStack(spacing: 8) {
                Text("Step 1 → Enable the extension in Safari.")
                    .font(.headline)

                Text("• Open Safari\n• Settings → Extensions\n• Enable “SparXion Chat Xport”")
                    .multilineTextAlignment(.center)
                    .font(.callout)
                    .foregroundColor(.secondary)
            }

            if extensionEnabled {
                Label("Extension is enabled", systemImage: "checkmark.circle.fill")
                    .foregroundColor(.green)
            } else {
                Button("Open Safari Extension Preferences…") {
                    SSPreferencesOpener.open()
                }
                .buttonStyle(.borderedProminent)
            }

            Spacer()
        }
        .padding()
        .frame(minWidth: 400, minHeight: 420)
        .task {
            extensionEnabled = await isExtensionEnabled()
        }
    }

    private func isExtensionEnabled() async -> Bool {
        await withCheckedContinuation { continuation in
            SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: "sparxion.com.Chat-Xport.Extension") { state, _ in
                continuation.resume(returning: state?.isEnabled ?? false)
            }
        }
    }
}//
//  ContentView.swift
//  Grok Chat Saver
//
//  Created by John Violette on 11/9/25.
//


//
//  AppEntry.swift
//  FISH
//
//  Created by Franz Evangelista on 7/5/26.
//

import SwiftUI

@main
struct AppEntry: App {
    init() {
        FontRegistry.registerAll()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

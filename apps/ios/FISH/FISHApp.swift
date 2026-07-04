//
//  FISHApp.swift
//  FISH
//
//  Created by Franz Evangelista on 7/5/26.
//

import SwiftUI

@main
struct FISHApp: App {
    init() {
        FontRegistry.registerAll()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

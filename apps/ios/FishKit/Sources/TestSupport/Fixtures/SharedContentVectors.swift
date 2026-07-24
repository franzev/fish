import ChatCore
import Foundation

public enum SharedContentJSONValue: Decodable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: SharedContentJSONValue])
    case array([SharedContentJSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: SharedContentJSONValue].self) {
            self = .object(value)
        } else {
            self = .array(try container.decode([SharedContentJSONValue].self))
        }
    }
}

public struct SharedContentVectors: Decodable, Sendable {
    public struct Phase12Case: Decodable, Sendable {
        public let name: String
        public let input: [String: SharedContentJSONValue]
        public let expected: [String: SharedContentJSONValue]

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            try Self.requireExactKeys(container.allKeys.map(\.stringValue), expected: ["name", "input", "expected"], decoder: decoder)
            name = try container.decode(String.self, forKey: .name)
            input = try container.decode([String: SharedContentJSONValue].self, forKey: .input)
            expected = try container.decode([String: SharedContentJSONValue].self, forKey: .expected)
        }

        private enum CodingKeys: String, CodingKey { case name, input, expected }

        private static func requireExactKeys(
            _ actual: [String],
            expected: [String],
            decoder: Decoder
        ) throws {
            guard Set(actual) == Set(expected) else {
                throw DecodingError.dataCorruptedError(
                    in: try decoder.singleValueContainer(),
                    debugDescription: "Phase 12 case keys drifted"
                )
            }
        }
    }

    public struct Phase12Group: Decodable, Sendable {
        public let cases: [Phase12Case]

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            guard Set(container.allKeys.map(\.stringValue)) == Set(["cases"]) else {
                throw DecodingError.dataCorruptedError(
                    in: try decoder.singleValueContainer(),
                    debugDescription: "Phase 12 group keys drifted"
                )
            }
            cases = try container.decode([Phase12Case].self, forKey: .cases)
        }

        private enum CodingKeys: String, CodingKey { case cases }
    }

    public struct Metadata: Decodable, Sendable {
        public let version: Int
        public let expectedCaseCount: Int
        public let expectedTask1CaseCount: Int
        public let groups: [String]
    }

    public struct ClassificationCase: Decodable, Sendable {
        public let name: String
        public let source: SharedContentSourceDescriptor
        public let conversationId: String?
        public let expected: SharedContentClassification?
    }

    public struct OrderingCase: Decodable, Sendable {
        public let name: String
        public let itemIds: [String]
        public let expectedItemIds: [String]
    }

    public struct PageExpectation: Decodable, Sendable {
        public let itemIds: [String]
        public let hasMore: Bool
        public let cursor: SharedContentCursor?
    }

    public struct PaginationCase: Decodable, Sendable {
        public let name: String
        public let pLimit: Int
        public let rows: [String]
        public let pageSize: Int
        public let expected: PageExpectation

        private enum CodingKeys: String, CodingKey {
            case name, rows, pageSize, expected
            case pLimit = "p_limit"
        }
    }

    public struct PermissionItem: Decodable, Sendable {
        public let kind: SharedContentKind
        public let canExport: Bool
    }

    public struct PermissionCase: Decodable, Sendable {
        public let name: String
        public let viewer: String
        public let items: [PermissionItem]?
        public let expected: [String: SharedContentJSONValue]
    }

    public struct GalleryStateCase: Decodable, Sendable {
        public let name: String
        public let status: String
    }

    public struct InitialState: Decodable, Sendable {
        public let identityId: String
        public let conversationId: String
        public let itemIds: [String]
        public let sourceMessageIds: [String]
        public let categories: [SharedContentCategory]?
        public let deliveryReferences: [String]?
        public let temporaryReferences: [String]?
        public let error: String?
        public let deletedSourceMessageIds: [String]

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            identityId = try container.decode(String.self, forKey: .identityId)
            conversationId = try container.decode(String.self, forKey: .conversationId)
            itemIds = try container.decodeIfPresent([String].self, forKey: .itemIds) ?? []
            sourceMessageIds = try container.decodeIfPresent([String].self, forKey: .sourceMessageIds) ?? []
            categories = try container.decodeIfPresent([SharedContentCategory].self, forKey: .categories)
            deliveryReferences = try container.decodeIfPresent([String].self, forKey: .deliveryReferences)
            temporaryReferences = try container.decodeIfPresent([String].self, forKey: .temporaryReferences)
            error = try container.decodeIfPresent(String.self, forKey: .error)
            deletedSourceMessageIds = try container.decodeIfPresent([String].self, forKey: .deletedSourceMessageIds) ?? []
        }

        private enum CodingKeys: String, CodingKey {
            case identityId, conversationId, itemIds, sourceMessageIds, categories
            case deliveryReferences, temporaryReferences, error, deletedSourceMessageIds
        }
    }

    public struct RawEvent: Decodable, Sendable {
        public let type: String
        public let identityId: String
        public let conversationId: String?
        public let identityGeneration: Int?
        public let sourceMessageId: String?
        public let itemIds: [String]?
        public let sourceMessageIds: [String]?
        public let itemId: String?
        public let requestId: String?
        public let requestedCursor: SharedContentCursor?
        public let replace: Bool?
        public let itemIdsPresent: Bool
        public let requestedCursorPresent: Bool

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            type = try container.decode(String.self, forKey: .type)
            identityId = try container.decode(String.self, forKey: .identityId)
            conversationId = try container.decodeIfPresent(String.self, forKey: .conversationId)
            identityGeneration = try container.decodeIfPresent(Int.self, forKey: .identityGeneration)
            sourceMessageId = try container.decodeIfPresent(String.self, forKey: .sourceMessageId)
            itemIds = try container.decodeIfPresent([String].self, forKey: .itemIds)
            sourceMessageIds = try container.decodeIfPresent([String].self, forKey: .sourceMessageIds)
            itemId = try container.decodeIfPresent(String.self, forKey: .itemId)
            requestId = try container.decodeIfPresent(String.self, forKey: .requestId)
            requestedCursor = try container.decodeIfPresent(SharedContentCursor.self, forKey: .requestedCursor)
            replace = try container.decodeIfPresent(Bool.self, forKey: .replace)
            itemIdsPresent = container.contains(.itemIds)
            requestedCursorPresent = container.contains(.requestedCursor)
        }

        private enum CodingKeys: String, CodingKey {
            case type, identityId, conversationId, identityGeneration, sourceMessageId, itemIds, sourceMessageIds, itemId
            case requestId, requestedCursor, replace
        }
    }

    public struct StateCase: Decodable, Sendable {
        public let name: String
        public let initial: InitialState
        public let events: [RawEvent]
        public let expected: [String: SharedContentJSONValue]
    }

    public let metadata: Metadata
    public let items: [String: SharedContentItem]
    public let classification: [ClassificationCase]
    public let ordering: [OrderingCase]
    public let pagination: [PaginationCase]
    public let permissions: [PermissionCase]
    public let galleryStates: [GalleryStateCase]
    public let identityPurge: [StateCase]
    public let deletionFanOut: [StateCase]
    public let requestSequencing: [StateCase]
    public let cacheHydration: [Phase12Case]
    public let cacheTruth: [Phase12Case]
    public let eviction: [Phase12Case]
    public let recovery: [Phase12Case]
    public let deliveryPlanning: [Phase12Case]
    public let dataSaving: [Phase12Case]
    public let urlNonPersistence: [Phase12Case]
    public let identityGeneration: [Phase12Case]

    enum CodingKeys: String, CodingKey {
        case metadata, items, classification, ordering, pagination, permissions, galleryStates, identityPurge, deletionFanOut
        case requestSequencing, cacheHydration, cacheTruth, eviction, recovery
        case deliveryPlanning, dataSaving, urlNonPersistence, identityGeneration
    }

    enum CasesKey: String, CodingKey { case cases }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let expectedKeys = Set([
            "metadata", "items", "classification", "ordering", "pagination", "permissions",
            "galleryStates", "identityPurge", "deletionFanOut", "requestSequencing",
            "cacheHydration", "cacheTruth", "eviction", "recovery", "deliveryPlanning",
            "dataSaving", "urlNonPersistence", "identityGeneration",
        ])
        guard Set(container.allKeys.map(\.stringValue)) == expectedKeys else {
            throw DecodingError.dataCorruptedError(
                in: try decoder.singleValueContainer(),
                debugDescription: "shared-content fixture top-level keys drifted"
            )
        }
        metadata = try container.decode(Metadata.self, forKey: .metadata)
        items = try container.decode([String: SharedContentItem].self, forKey: .items)
        classification = try Self.decodeCases(ClassificationCase.self, from: container, key: .classification)
        ordering = try Self.decodeCases(OrderingCase.self, from: container, key: .ordering)
        pagination = try Self.decodeCases(PaginationCase.self, from: container, key: .pagination)
        permissions = try Self.decodeCases(PermissionCase.self, from: container, key: .permissions)
        galleryStates = try Self.decodeCases(GalleryStateCase.self, from: container, key: .galleryStates)
        identityPurge = try Self.decodeCases(StateCase.self, from: container, key: .identityPurge)
        deletionFanOut = try Self.decodeCases(StateCase.self, from: container, key: .deletionFanOut)
        requestSequencing = try Self.decodeCases(StateCase.self, from: container, key: .requestSequencing)
        cacheHydration = try Self.decodePhase12Cases(from: container, key: .cacheHydration)
        cacheTruth = try Self.decodePhase12Cases(from: container, key: .cacheTruth)
        eviction = try Self.decodePhase12Cases(from: container, key: .eviction)
        recovery = try Self.decodePhase12Cases(from: container, key: .recovery)
        deliveryPlanning = try Self.decodePhase12Cases(from: container, key: .deliveryPlanning)
        dataSaving = try Self.decodePhase12Cases(from: container, key: .dataSaving)
        urlNonPersistence = try Self.decodePhase12Cases(from: container, key: .urlNonPersistence)
        identityGeneration = try Self.decodePhase12Cases(from: container, key: .identityGeneration)
    }

    public static func load() throws -> SharedContentVectors {
        try JSONDecoder().decode(SharedContentVectors.self, from: rawJSON())
    }

    public static func rawJSON() throws -> Data {
        guard let url = Bundle.module.url(forResource: "shared-content-vectors", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try Data(contentsOf: url)
    }

    private static func decodeCases<Value: Decodable>(
        _ type: Value.Type,
        from container: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) throws -> [Value] {
        let group = try container.nestedContainer(keyedBy: CasesKey.self, forKey: key)
        return try group.decode([Value].self, forKey: .cases)
    }

    private static func decodePhase12Cases(
        from container: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) throws -> [Phase12Case] {
        let group = try container.nestedContainer(keyedBy: CasesKey.self, forKey: key)
        return try group.decode([Phase12Case].self, forKey: .cases)
    }
}

// GENERATED — do not edit by hand.
// Source: content/store.json (content v2689b00d). Regenerate: npm run content:pull.
import type { ScenarioDefinition } from './scenario/types';

export const SCENARIO_CONTENT_VERSION = "2689b00d";

export const GENERATED_SCENARIOS = [
  {
    "id": "bad_history",
    "tags": [
      "personal-history",
      "avoidance"
    ],
    "eligibility": {
      "requiredWorldTags": [],
      "excludedWorldTags": [],
      "selectionWeight": 1,
      "exclusiveGroup": ""
    },
    "roles": [
      {
        "id": "difficult_history",
        "required": true,
        "allowSharedActor": false,
        "actorRolesAny": [
          "former-roommate"
        ],
        "actorTagsAll": [],
        "actorTagsNone": [],
        "reachesAny": [
          "local"
        ]
      }
    ],
    "initialFacts": [
      {
        "id": "history_tone",
        "kind": "scenario_fact",
        "roleId": "",
        "factKey": "history_tone",
        "value": "avoidant",
        "sourceRef": "scenario:bad_history"
      }
    ],
    "hooks": [
      {
        "id": "history_encounter",
        "kind": "bound_actor_colocated",
        "roleId": "difficult_history",
        "factKey": "",
        "oneShot": true,
        "presentationCue": "unwelcome_familiar_face"
      }
    ],
    "presentation": {
      "titleKey": "scenario.bad_history.title",
      "summaryKey": "scenario.bad_history.summary",
      "hiddenUntilHookId": "history_encounter"
    }
  },
  {
    "id": "family_connection",
    "tags": [
      "personal-history",
      "family"
    ],
    "eligibility": {
      "requiredWorldTags": [],
      "excludedWorldTags": [],
      "selectionWeight": 1,
      "exclusiveGroup": ""
    },
    "roles": [
      {
        "id": "family_connection",
        "required": true,
        "allowSharedActor": false,
        "actorRolesAny": [
          "landlord"
        ],
        "actorTagsAll": [],
        "actorTagsNone": [],
        "reachesAny": [
          "local"
        ]
      }
    ],
    "initialFacts": [
      {
        "id": "family_familiarity",
        "kind": "social_history",
        "roleId": "family_connection",
        "factKey": "familiarity",
        "value": 30,
        "sourceRef": "scenario:family_connection"
      },
      {
        "id": "known_family_contact",
        "kind": "player_knowledge",
        "roleId": "family_connection",
        "factKey": "bound_actor_handle",
        "value": true,
        "sourceRef": "scenario:family_connection"
      }
    ],
    "hooks": [
      {
        "id": "family_contact_nearby",
        "kind": "bound_actor_colocated",
        "roleId": "family_connection",
        "factKey": "",
        "oneShot": true,
        "presentationCue": "family_connection_nearby"
      }
    ],
    "presentation": {
      "titleKey": "scenario.family_connection.title",
      "summaryKey": "scenario.family_connection.summary",
      "hiddenUntilHookId": "family_contact_nearby"
    }
  },
  {
    "id": "first_job_lead",
    "tags": [
      "move-motivation",
      "work"
    ],
    "eligibility": {
      "requiredWorldTags": [],
      "excludedWorldTags": [],
      "selectionWeight": 1,
      "exclusiveGroup": ""
    },
    "roles": [
      {
        "id": "job_contact",
        "required": true,
        "allowSharedActor": false,
        "actorRolesAny": [
          "diner-staff"
        ],
        "actorTagsAll": [],
        "actorTagsNone": [],
        "reachesAny": [
          "local"
        ]
      }
    ],
    "initialFacts": [
      {
        "id": "lead_familiarity",
        "kind": "social_history",
        "roleId": "job_contact",
        "factKey": "familiarity",
        "value": 20,
        "sourceRef": "scenario:first_job_lead"
      },
      {
        "id": "known_job_contact",
        "kind": "player_knowledge",
        "roleId": "job_contact",
        "factKey": "bound_actor_handle",
        "value": true,
        "sourceRef": "scenario:first_job_lead"
      },
      {
        "id": "lead_status",
        "kind": "scenario_fact",
        "roleId": "",
        "factKey": "lead_status",
        "value": "rumor_only",
        "sourceRef": "scenario:first_job_lead"
      }
    ],
    "hooks": [
      {
        "id": "job_lead_search",
        "kind": "search_term",
        "roleId": "job_contact",
        "factKey": "job lead",
        "oneShot": true,
        "presentationCue": "old_job_lead_recalled"
      }
    ],
    "presentation": {
      "titleKey": "scenario.first_job_lead.title",
      "summaryKey": "scenario.first_job_lead.summary",
      "hiddenUntilHookId": "job_lead_search"
    }
  },
  {
    "id": "old_debt",
    "tags": [
      "personal-history",
      "obligation"
    ],
    "eligibility": {
      "requiredWorldTags": [],
      "excludedWorldTags": [],
      "selectionWeight": 1,
      "exclusiveGroup": ""
    },
    "roles": [
      {
        "id": "old_debtor",
        "required": true,
        "allowSharedActor": false,
        "actorRolesAny": [
          "cart-owner"
        ],
        "actorTagsAll": [],
        "actorTagsNone": [],
        "reachesAny": [
          "local"
        ]
      }
    ],
    "initialFacts": [
      {
        "id": "debt_familiarity",
        "kind": "social_history",
        "roleId": "old_debtor",
        "factKey": "familiarity",
        "value": 30,
        "sourceRef": "scenario:old_debt"
      },
      {
        "id": "debt_memory",
        "kind": "social_history",
        "roleId": "old_debtor",
        "factKey": "memory",
        "value": "There is unfinished business from before the move.",
        "sourceRef": "scenario:old_debt"
      },
      {
        "id": "debt_kind",
        "kind": "scenario_fact",
        "roleId": "",
        "factKey": "obligation_kind",
        "value": "unresolved",
        "sourceRef": "scenario:old_debt"
      }
    ],
    "hooks": [
      {
        "id": "debt_search",
        "kind": "search_term",
        "roleId": "old_debtor",
        "factKey": "old debt",
        "oneShot": true,
        "presentationCue": "old_obligation_recalled"
      },
      {
        "id": "debtor_nearby",
        "kind": "bound_actor_colocated",
        "roleId": "old_debtor",
        "factKey": "",
        "oneShot": true,
        "presentationCue": "unfinished_business_nearby"
      }
    ],
    "presentation": {
      "titleKey": "scenario.old_debt.title",
      "summaryKey": "scenario.old_debt.summary",
      "hiddenUntilHookId": "debt_search"
    }
  },
  {
    "id": "someone_from_before",
    "tags": [
      "personal-history",
      "old-acquaintance"
    ],
    "eligibility": {
      "requiredWorldTags": [],
      "excludedWorldTags": [],
      "selectionWeight": 1,
      "exclusiveGroup": ""
    },
    "roles": [
      {
        "id": "old_acquaintance",
        "required": true,
        "allowSharedActor": false,
        "actorRolesAny": [
          "canal-regular"
        ],
        "actorTagsAll": [],
        "actorTagsNone": [],
        "reachesAny": [
          "local"
        ]
      }
    ],
    "initialFacts": [
      {
        "id": "prior_familiarity",
        "kind": "social_history",
        "roleId": "old_acquaintance",
        "factKey": "familiarity",
        "value": 35,
        "sourceRef": "scenario:someone_from_before"
      },
      {
        "id": "remembered_handle",
        "kind": "player_knowledge",
        "roleId": "old_acquaintance",
        "factKey": "bound_actor_handle",
        "value": true,
        "sourceRef": "scenario:someone_from_before"
      },
      {
        "id": "history_origin",
        "kind": "scenario_fact",
        "roleId": "",
        "factKey": "history_origin",
        "value": "before_oakhaven",
        "sourceRef": "scenario:someone_from_before"
      }
    ],
    "hooks": [
      {
        "id": "old_handle_search",
        "kind": "search_term",
        "roleId": "old_acquaintance",
        "factKey": "old username",
        "oneShot": true,
        "presentationCue": "remembered_old_acquaintance"
      },
      {
        "id": "chance_encounter",
        "kind": "bound_actor_colocated",
        "roleId": "old_acquaintance",
        "factKey": "",
        "oneShot": true,
        "presentationCue": "familiar_face_nearby"
      }
    ],
    "presentation": {
      "titleKey": "scenario.someone_from_before.title",
      "summaryKey": "scenario.someone_from_before.summary",
      "hiddenUntilHookId": "old_handle_search"
    }
  }
] as const satisfies readonly ScenarioDefinition[];

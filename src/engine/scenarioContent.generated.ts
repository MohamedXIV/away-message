// GENERATED — do not edit by hand.
// Source: content/store.json (content vaa79ad61). Regenerate: npm run content:pull.
import type { ScenarioDefinition } from './scenario/types';

export const SCENARIO_CONTENT_VERSION = "aa79ad61";

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
      "selectionWeight": 0.7,
      "exclusiveGroup": ""
    },
    "roles": [
      {
        "id": "past_contact",
        "required": true,
        "allowSharedActor": false,
        "actorRolesAny": [],
        "actorTagsAll": [
          "local"
        ],
        "actorTagsNone": [],
        "reachesAny": [
          "local"
        ]
      }
    ],
    "initialFacts": [
      {
        "id": "old_tension",
        "kind": "social_history",
        "roleId": "past_contact",
        "factKey": "annoyance",
        "value": 25,
        "sourceRef": "scenario:bad_history"
      },
      {
        "id": "old_suspicion",
        "kind": "social_history",
        "roleId": "past_contact",
        "factKey": "suspicion",
        "value": 15,
        "sourceRef": "scenario:bad_history"
      }
    ],
    "hooks": [
      {
        "id": "unexpected_overlap",
        "kind": "bound_actor_colocated",
        "roleId": "past_contact",
        "factKey": "",
        "oneShot": true,
        "presentationCue": "bad_history_nearby"
      }
    ],
    "presentation": {
      "titleKey": "scenario.bad_history.title",
      "summaryKey": "scenario.bad_history.summary",
      "hiddenUntilHookId": "unexpected_overlap"
    }
  },
  {
    "id": "family_connection",
    "tags": [
      "family",
      "personal-history"
    ],
    "eligibility": {
      "requiredWorldTags": [],
      "excludedWorldTags": [],
      "selectionWeight": 0.9,
      "exclusiveGroup": ""
    },
    "roles": [
      {
        "id": "family_contact",
        "required": true,
        "allowSharedActor": false,
        "actorRolesAny": [],
        "actorTagsAll": [
          "local"
        ],
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
        "roleId": "family_contact",
        "factKey": "familiarity",
        "value": 25,
        "sourceRef": "scenario:family_connection"
      },
      {
        "id": "remembered_account",
        "kind": "player_knowledge",
        "roleId": "family_contact",
        "factKey": "bound_actor_handle",
        "value": true,
        "sourceRef": "scenario:family_connection"
      },
      {
        "id": "connection_kind",
        "kind": "scenario_fact",
        "roleId": "",
        "factKey": "connection_kind",
        "value": "family_friend",
        "sourceRef": "scenario:family_connection"
      }
    ],
    "hooks": [
      {
        "id": "family_name_search",
        "kind": "search_term",
        "roleId": "family_contact",
        "factKey": "family name",
        "oneShot": true,
        "presentationCue": "family_connection_clue"
      }
    ],
    "presentation": {
      "titleKey": "scenario.family_connection.title",
      "summaryKey": "scenario.family_connection.summary",
      "hiddenUntilHookId": "family_name_search"
    }
  },
  {
    "id": "first_job_lead",
    "tags": [
      "work",
      "personal-history"
    ],
    "eligibility": {
      "requiredWorldTags": [],
      "excludedWorldTags": [],
      "selectionWeight": 1.1,
      "exclusiveGroup": ""
    },
    "roles": [
      {
        "id": "job_contact",
        "required": true,
        "allowSharedActor": false,
        "actorRolesAny": [
          "cart-owner"
        ],
        "actorTagsAll": [
          "local"
        ],
        "actorTagsNone": [],
        "reachesAny": [
          "local"
        ]
      }
    ],
    "initialFacts": [
      {
        "id": "remembered_account",
        "kind": "player_knowledge",
        "roleId": "job_contact",
        "factKey": "bound_actor_handle",
        "value": true,
        "sourceRef": "scenario:first_job_lead"
      },
      {
        "id": "lead_kind",
        "kind": "scenario_fact",
        "roleId": "",
        "factKey": "lead_kind",
        "value": "work_rumor",
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
        "presentationCue": "first_job_lead_clue"
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
      "obligation",
      "personal-history"
    ],
    "eligibility": {
      "requiredWorldTags": [],
      "excludedWorldTags": [],
      "selectionWeight": 0.8,
      "exclusiveGroup": ""
    },
    "roles": [
      {
        "id": "creditor",
        "required": true,
        "allowSharedActor": false,
        "actorRolesAny": [],
        "actorTagsAll": [
          "local"
        ],
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
        "roleId": "creditor",
        "factKey": "familiarity",
        "value": 20,
        "sourceRef": "scenario:old_debt"
      },
      {
        "id": "obligation_kind",
        "kind": "scenario_fact",
        "roleId": "",
        "factKey": "obligation_kind",
        "value": "practical",
        "sourceRef": "scenario:old_debt"
      }
    ],
    "hooks": [
      {
        "id": "debt_reminder",
        "kind": "knowledge_fact",
        "roleId": "creditor",
        "factKey": "debt_reminder_known",
        "oneShot": true,
        "presentationCue": "old_debt_remembered"
      }
    ],
    "presentation": {
      "titleKey": "scenario.old_debt.title",
      "summaryKey": "scenario.old_debt.summary",
      "hiddenUntilHookId": "debt_reminder"
    }
  },
  {
    "id": "someone_from_before",
    "tags": [
      "personal-history",
      "open-ended"
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
        "actorRolesAny": [],
        "actorTagsAll": [
          "local"
        ],
        "actorTagsNone": [
          "role:landlord"
        ],
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
        "id": "shared_past",
        "kind": "social_history",
        "roleId": "old_acquaintance",
        "factKey": "memory",
        "value": "We knew each other years before Oakhaven.",
        "sourceRef": "scenario:someone_from_before"
      },
      {
        "id": "remembered_account",
        "kind": "player_knowledge",
        "roleId": "old_acquaintance",
        "factKey": "bound_actor_handle",
        "value": true,
        "sourceRef": "scenario:someone_from_before"
      },
      {
        "id": "origin",
        "kind": "scenario_fact",
        "roleId": "",
        "factKey": "origin",
        "value": "nearby_village",
        "sourceRef": "scenario:someone_from_before"
      }
    ],
    "hooks": [
      {
        "id": "old_handle_search",
        "kind": "search_term",
        "roleId": "old_acquaintance",
        "factKey": "old surname",
        "oneShot": true,
        "presentationCue": "remembered_old_acquaintance_search"
      },
      {
        "id": "chance_overlap",
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

// Main Ink Story Entry & Variable Definitions

VAR sim_current_day = 1
VAR sim_current_time_minute = 480
VAR sim_time_of_day = "morning"
VAR sim_player_cash = 38
VAR sim_player_energy = 100
VAR sim_player_fatigue = 0
VAR sim_os_version = "Orion_4.8"
VAR sim_ram_mb = 512
VAR sim_connection_type = "dsl_256k"
VAR sim_photobox_installed = false
VAR sim_weatherbuddy_installed = false
VAR sim_safesweep_installed = false
VAR sim_flashfetch_installed = false
VAR sim_zipmate_installed = false
VAR sim_retroamp_installed = false
VAR sim_rent_paid = false
VAR sim_internet_paid = false

VAR sim_maya_familiarity = 10
VAR sim_maya_trust = 20
VAR sim_maya_comfort = 30
VAR sim_maya_respect = 40
VAR sim_maya_annoyance = 0

VAR sim_ryan_familiarity = 40
VAR sim_ryan_trust = 50
VAR sim_ryan_comfort = 50
VAR sim_ryan_respect = 40
VAR sim_ryan_annoyance = 0

VAR sim_nora_familiarity = 5
VAR sim_nora_trust = 15
VAR sim_nora_comfort = 20
VAR sim_nora_respect = 50
VAR sim_nora_annoyance = 0

VAR sim_henderson_familiarity = 30
VAR sim_henderson_trust = 30
VAR sim_henderson_comfort = 20
VAR sim_henderson_respect = 40
VAR sim_henderson_annoyance = 10

EXTERNAL has_flag(key)
EXTERNAL get_flag_string(key)
EXTERNAL get_flag_number(key)
EXTERNAL is_installed(appId)
EXTERNAL get_relationship(buddyId, dimension)

INCLUDE characters/ryan.ink
INCLUDE characters/maya.ink
INCLUDE characters/nora.ink
INCLUDE characters/henderson.ink
INCLUDE scenes/cafe_meeting.ink
INCLUDE scenes/ending.ink

-> maya_day1

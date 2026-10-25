/** Fixed authored file associations; never infer software ID from arbitrary executables. */
export const INSTALLER_SOFTWARE_IDS: Readonly<Record<string, string>> = Object.freeze({
  'pulse52_setup.exe': 'sw_pulse_52',
  'pulse_5.2.exe': 'sw_pulse_52',
  'pulse_5.2_setup.exe': 'sw_pulse_52',
  'pulse_6.0.exe': 'sw_pulse_60',
  'retroamp_setup.exe': 'sw_retroamp_23',
  'flashfetch_setup.exe': 'sw_flashfetch_31',
  'zipmate_setup.exe': 'sw_zipmate_40',
  'weatherbuddy_bundle.exe': 'sw_weatherbuddy_14',
  'safesweep_setup.exe': 'sw_safesweep_20',
  'photobox_setup.exe': 'sw_photobox_30',
});

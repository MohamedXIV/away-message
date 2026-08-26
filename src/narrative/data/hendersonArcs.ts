import { StoryKnot } from '../types';

export const HENDERSON_14DAY_KNOTS: StoryKnot[] = [
  // Day 1
  {
    id: 'henderson_day1',
    characterId: 'henderson',
    title: 'Room 104 Occupancy & Policies',
    day: 1,
    lines: [
      {
        id: 'h1_1',
        speaker: 'henderson',
        text: 'This is the Starlite Motel Front Office. Welcome to Room 104.',
      },
      {
        id: 'h1_2',
        speaker: 'henderson',
        text: 'Quiet hours begin promptly at 22:00. The DSL jack is provided as a courtesy; do not tamper with the external wall junction box.',
      },
    ],
    choices: [
      {
        id: 'c_h1_polite',
        text: 'Understood, Mr. Henderson. I will keep noise down and respect the property.',
        socialAction: 'empathy',
        targetKnot: 'henderson_day1_polite',
        tags: ['# beat:henderson_day1_complete', '# social:henderson:empathy'],
      },
      {
        id: 'c_h1_dsl',
        text: 'Thank you. Is the copper line dedicated or shared across the south motel wing?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'henderson_day1_dsl_reply',
        tags: ['# beat:henderson_day1_complete', '# social:henderson:intellectual_curiosity'],
      },
    ],
  },
  {
    id: 'henderson_day1_polite',
    characterId: 'henderson',
    lines: [
      {
        id: 'h1_p1',
        speaker: 'henderson',
        text: 'Good. We value quiet tenants. Let me know if the plumbing needs inspection.',
        tags: ['# beat:henderson_day1_complete'],
      },
    ],
  },
  {
    id: 'henderson_day1_dsl_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h1_d1',
        speaker: 'henderson',
        text: 'Dedicated copper pair straight to the main distribution frame. Do not overload the circuit with unapproved appliances.',
        tags: ['# beat:henderson_day1_complete'],
      },
    ],
  },

  // Day 3
  {
    id: 'henderson_day3',
    characterId: 'henderson',
    title: 'Water Heater & Electrical Maintenance',
    day: 3,
    lines: [
      {
        id: 'h3_1',
        speaker: 'henderson',
        text: 'Notice to Room 104: The municipal inspector will be checking the boiler room at 14:00 today.',
      },
      {
        id: 'h3_2',
        speaker: 'henderson',
        text: 'Hot water pressure may fluctuate briefly. Thank you for your cooperation.',
      },
    ],
    choices: [
      {
        id: 'c_h3_ack',
        text: 'Thank you for the advance notice, Mr. Henderson. Much appreciated.',
        socialAction: 'empathy',
        targetKnot: 'henderson_day3_ack_reply',
        tags: ['# beat:henderson_day3_complete', '# social:henderson:empathy'],
      },
      {
        id: 'c_h3_power',
        text: 'Will the power stay on for computer workstations during the boiler inspection?',
        socialAction: 'work_camaraderie',
        targetKnot: 'henderson_day3_power_reply',
        tags: ['# beat:henderson_day3_complete', '# social:henderson:work_camaraderie'],
      },
    ],
  },
  {
    id: 'henderson_day3_ack_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h3_a1',
        speaker: 'henderson',
        text: 'Of course. Proper maintenance keeps our rates reasonable.',
        tags: ['# beat:henderson_day3_complete'],
      },
    ],
  },
  {
    id: 'henderson_day3_power_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h3_pw1',
        speaker: 'henderson',
        text: 'Electrical breakers are on an independent sub-panel. Your computer will experience zero disruption.',
        tags: ['# beat:henderson_day3_complete'],
      },
    ],
  },

  // Day 5
  {
    id: 'henderson_day5',
    characterId: 'henderson',
    title: 'Advance Notice: Week 1 Rent Due Day 7',
    day: 5,
    lines: [
      {
        id: 'h5_1',
        speaker: 'henderson',
        text: 'Reminder: Week 1 rent payment of $140.00 is due on Day 7 by 20:00.',
      },
      {
        id: 'h5_2',
        speaker: 'henderson',
        text: 'You may pay directly through the terminal billing portal or in person at the front desk.',
      },
    ],
    choices: [
      {
        id: 'c_h5_noted',
        text: 'Received and noted. I will ensure the funds are ready on Day 7.',
        socialAction: 'work_camaraderie',
        targetKnot: 'henderson_day5_noted_reply',
        tags: [
          '# beat:henderson_day5_complete',
          '# effect:flag:henderson_rent_warned:true',
          '# social:henderson:work_camaraderie',
        ],
      },
      {
        id: 'c_h5_receipt',
        text: 'Does the terminal issue a digital receipt for tax accounting records?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'henderson_day5_receipt_reply',
        tags: [
          '# beat:henderson_day5_complete',
          '# effect:flag:henderson_rent_warned:true',
          '# social:henderson:intellectual_curiosity',
        ],
      },
    ],
  },
  {
    id: 'henderson_day5_noted_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h5_n1',
        speaker: 'henderson',
        text: 'Very good. Punctual rent payments ensure continued quiet tenancy.',
        tags: ['# beat:henderson_day5_complete'],
      },
    ],
  },
  {
    id: 'henderson_day5_receipt_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h5_r1',
        speaker: 'henderson',
        text: 'Yes, an automated transaction record is logged in the motel registry database.',
        tags: ['# beat:henderson_day5_complete'],
      },
    ],
  },

  // Day 7
  {
    id: 'henderson_day7',
    characterId: 'henderson',
    title: 'Week 1 Rent Reconciliation',
    day: 7,
    lines: [
      {
        id: 'h7_1',
        speaker: 'henderson',
        text: 'Today is Day 7 rent reconciliation day.',
      },
      {
        id: 'h7_2',
        speaker: 'henderson',
        text: 'Checking the payment ledger for Room 104...',
      },
    ],
    choices: [
      {
        id: 'c_h7_paid',
        text: 'Paid in full ($140.00) through the simulation action portal, Mr. Henderson.',
        socialAction: 'work_camaraderie',
        targetKnot: 'henderson_day7_receipt',
        tags: ['# beat:henderson_day7_complete', '# social:henderson:work_camaraderie'],
      },
      {
        id: 'c_h7_working',
        text: 'Finishing up today’s work shift wages right now to complete the payment.',
        socialAction: 'empathy',
        targetKnot: 'henderson_day7_grace',
        tags: ['# beat:henderson_day7_complete', '# social:henderson:empathy'],
      },
    ],
  },
  {
    id: 'henderson_day7_receipt',
    characterId: 'henderson',
    lines: [
      {
        id: 'h7_rc1',
        speaker: 'henderson',
        text: 'Payment received and logged. Room 104 is in good standing for Week 2. Enjoy your evening.',
        tags: ['# beat:henderson_day7_complete'],
      },
    ],
  },
  {
    id: 'henderson_day7_grace',
    characterId: 'henderson',
    lines: [
      {
        id: 'h7_gr1',
        speaker: 'henderson',
        text: 'Ensure the balance is cleared before 20:00 tonight. We do not extend credit.',
        tags: ['# beat:henderson_day7_complete'],
      },
    ],
  },

  // Day 9
  {
    id: 'henderson_day9',
    characterId: 'henderson',
    title: 'TechMart Hardware Package Delivery',
    day: 9,
    lines: [
      {
        id: 'h9_1',
        speaker: 'henderson',
        text: 'A courier dropped off a parcel from TechMart Hardware addressed to Room 104.',
      },
      {
        id: 'h9_2',
        speaker: 'henderson',
        text: 'I placed it outside your room door. Please dispose of the cardboard packaging responsibly in the outer dumpster.',
      },
    ],
    choices: [
      {
        id: 'c_h9_thanks',
        text: 'Thank you very much for receiving the package, Mr. Henderson. I will recycle the box.',
        socialAction: 'empathy',
        targetKnot: 'henderson_day9_thanks_reply',
        tags: ['# beat:henderson_day9_complete', '# social:henderson:empathy'],
      },
      {
        id: 'c_h9_fast',
        text: 'TechMart shipping was fast! Time to install the upgrade.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'henderson_day9_tech_reply',
        tags: ['# beat:henderson_day9_complete', '# social:henderson:intellectual_curiosity'],
      },
    ],
  },
  {
    id: 'henderson_day9_thanks_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h9_th1',
        speaker: 'henderson',
        text: 'Appreciated. Clean corridors are required by town fire code.',
        tags: ['# beat:henderson_day9_complete'],
      },
    ],
  },
  {
    id: 'henderson_day9_tech_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h9_tc1',
        speaker: 'henderson',
        text: 'Just ensure whatever you install does not exceed our electrical load limits.',
        tags: ['# beat:henderson_day9_complete'],
      },
    ],
  },

  // Day 11
  {
    id: 'henderson_day11',
    characterId: 'henderson',
    title: 'Rainy Weather & Motel Lobby Protocol',
    day: 11,
    lines: [
      {
        id: 'h11_1',
        speaker: 'henderson',
        text: 'Severe rain advisory today. Canal water level is approaching the lower catwalk.',
      },
      {
        id: 'h11_2',
        speaker: 'henderson',
        text: 'If you are heading out to 4th Street, please use the umbrella stand in the vestibule and wipe your boots thoroughly on the mat.',
      },
    ],
    choices: [
      {
        id: 'c_h11_careful',
        text: 'Will do, Mr. Henderson. Heading over to 4th St Diner for coffee now. Staying dry!',
        socialAction: 'empathy',
        targetKnot: 'henderson_day11_diner_reply',
        tags: ['# beat:henderson_day11_complete', '# social:henderson:empathy'],
      },
      {
        id: 'c_h11_boots',
        text: 'Always wipe the boots. Clean lobby floors matter.',
        socialAction: 'tease_playful',
        targetKnot: 'henderson_day11_boots_reply',
        tags: ['# beat:henderson_day11_complete', '# social:henderson:tease_playful'],
      },
    ],
  },
  {
    id: 'henderson_day11_diner_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h11_dn1',
        speaker: 'henderson',
        text: 'The coffee at 4th St Diner is respectable. Tell them Henderson sent you.',
        tags: ['# beat:henderson_day11_complete'],
      },
    ],
  },
  {
    id: 'henderson_day11_boots_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h11_bt1',
        speaker: 'henderson',
        text: 'Indeed they do. Wet linoleum is a severe liability.',
        tags: ['# beat:henderson_day11_complete'],
      },
    ],
  },

  // Day 12
  {
    id: 'henderson_day12',
    characterId: 'henderson',
    title: 'Advance Notice: Week 2 Rent Due Day 14',
    day: 12,
    lines: [
      {
        id: 'h12_1',
        speaker: 'henderson',
        text: 'Advance notice: Week 2 rent ($140.00) will be due on Day 14.',
      },
      {
        id: 'h12_2',
        speaker: 'henderson',
        text: 'Completing Week 2 concludes your initial two-week tenancy evaluation period.',
      },
    ],
    choices: [
      {
        id: 'c_h12_on_track',
        text: 'Understood. My finances are budgeted and ready for Day 14.',
        socialAction: 'work_camaraderie',
        targetKnot: 'henderson_day12_budget_reply',
        tags: ['# beat:henderson_day12_complete', '# social:henderson:work_camaraderie'],
      },
      {
        id: 'c_h12_tenancy',
        text: 'I have really enjoyed my time in Room 104. Hope to stay in free play beyond Day 14.',
        socialAction: 'vulnerable_share',
        targetKnot: 'henderson_day12_stay_reply',
        tags: ['# beat:henderson_day12_complete', '# social:henderson:vulnerable_share'],
      },
    ],
  },
  {
    id: 'henderson_day12_budget_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h12_bg1',
        speaker: 'henderson',
        text: 'Good financial discipline is the hallmark of a reliable resident.',
        tags: ['# beat:henderson_day12_complete'],
      },
    ],
  },
  {
    id: 'henderson_day12_stay_reply',
    characterId: 'henderson',
    lines: [
      {
        id: 'h12_st1',
        speaker: 'henderson',
        text: 'You have been a quiet and orderly tenant. We would be pleased to have you extend indefinitely.',
        tags: ['# beat:henderson_day12_complete'],
      },
    ],
  },

  // Day 14
  {
    id: 'henderson_day14',
    characterId: 'henderson',
    title: 'Two-Week Evaluation Final Clearance',
    day: 14,
    lines: [
      {
        id: 'h14_1',
        speaker: 'henderson',
        text: 'Day 14 evaluation concluded. Both weekly rent obligations have been processed successfully.',
      },
      {
        id: 'h14_2',
        speaker: 'henderson',
        text: 'Zero noise complaints, zero property damage, and prompt accounts. Room 104 is officially yours for as long as you wish to stay.',
      },
    ],
    choices: [
      {
        id: 'c_h14_thanks',
        text: 'Thank you for providing a stable, quiet home, Mr. Henderson. Honored to stay here.',
        socialAction: 'vulnerable_share',
        targetKnot: 'henderson_day14_final_blessing',
        tags: [
          '# beat:henderson_day14_complete',
          '# effect:flag:henderson_arc_completed:true',
          '# social:henderson:vulnerable_share',
        ],
      },
      {
        id: 'c_h14_steady',
        text: 'Room 104 will continue to be kept in impeccable condition.',
        socialAction: 'work_camaraderie',
        targetKnot: 'henderson_day14_final_handshake',
        tags: [
          '# beat:henderson_day14_complete',
          '# effect:flag:henderson_arc_completed:true',
          '# social:henderson:work_camaraderie',
        ],
      },
    ],
  },
  {
    id: 'henderson_day14_final_blessing',
    characterId: 'henderson',
    lines: [
      {
        id: 'h14_fb1',
        speaker: 'henderson',
        text: 'Welcome permanently to Starlite Motel. The desk is always open if you need anything.',
        tags: ['# beat:henderson_day14_complete', '# effect:flag:henderson_arc_completed:true'],
      },
    ],
  },
  {
    id: 'henderson_day14_final_handshake',
    characterId: 'henderson',
    lines: [
      {
        id: 'h14_fh1',
        speaker: 'henderson',
        text: 'Excellent. Keep up the good work. Good evening, neighbor.',
        tags: ['# beat:henderson_day14_complete', '# effect:flag:henderson_arc_completed:true'],
      },
    ],
  },
];

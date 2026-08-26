import { StoryKnot } from '../types';

export const NORA_14DAY_KNOTS: StoryKnot[] = [
  // Day 1
  {
    id: 'nora_day1',
    characterId: 'nora',
    title: 'Acoustic Leakage on Port 8080',
    day: 1,
    lines: [
      {
        id: 'n1_1',
        speaker: 'nora',
        text: '...you are in Room 104 at Starlite, right?',
      },
      {
        id: 'n1_2',
        speaker: 'nora',
        text: 'pay attention to your audio speakers tonight around 2:45 AM. The canal sub-bass resonance leaks into the sound card line-in.',
      },
    ],
    choices: [
      {
        id: 'c_n1_rec',
        text: 'I will set up RetroAmp and line-in recording to capture the frequency spectrum.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day1_forensics',
        tags: ['# beat:nora_day1_complete', '# social:nora:intellectual_curiosity'],
      },
      {
        id: 'c_n1_skeptic',
        text: 'Isn’t that just the municipal water pumps cycling?',
        socialAction: 'empathy',
        targetKnot: 'nora_day1_skeptic',
        tags: ['# beat:nora_day1_complete', '# social:nora:empathy'],
      },
    ],
  },
  {
    id: 'nora_day1_forensics',
    characterId: 'nora',
    lines: [
      {
        id: 'n1_f1',
        speaker: 'nora',
        text: 'excellent. I uploaded an acoustic sample to PeerBox: `sub_canal_drone.wav`.',
      },
      {
        id: 'n1_f2',
        speaker: 'nora',
        text: 'compare the wave peaks with NightBoard thread #104. We are onto something big.',
        tags: ['# beat:nora_day1_complete'],
      },
    ],
  },
  {
    id: 'nora_day1_skeptic',
    characterId: 'nora',
    lines: [
      {
        id: 'n1_sk1',
        speaker: 'nora',
        text: 'that is what CityWire reported, but water pumps do not emit frequency-modulated carrier signals on port 8080.',
        tags: ['# beat:nora_day1_complete'],
      },
    ],
  },

  // Day 2
  {
    id: 'nora_day2',
    characterId: 'nora',
    title: 'Waveform Analysis & PeerBox Nodes',
    day: 2,
    lines: [
      {
        id: 'n2_1',
        speaker: 'nora',
        text: 'did you download `sub_canal_drone.wav` from peerbox.local?',
      },
      {
        id: 'n2_2',
        speaker: 'nora',
        text: 'if you plot the fast Fourier transform of the audio, you will see harmonic spikes at exactly 432 Hz and 864 Hz every seventeen minutes.',
      },
    ],
    choices: [
      {
        id: 'c_n2_fft',
        text: 'That frequency matches the power grid phase synchronization near the old pumping station.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day2_fft_reply',
        tags: [
          '# beat:nora_day2_complete',
          '# effect:flag:nora_canal_audio_shared:true',
          '# social:nora:intellectual_curiosity',
        ],
      },
      {
        id: 'c_n2_intrigue',
        text: 'How long have you been mapping these frequencies in Oakhaven?',
        socialAction: 'vulnerable_share',
        targetKnot: 'nora_day2_history',
        tags: [
          '# beat:nora_day2_complete',
          '# effect:flag:nora_canal_audio_shared:true',
          '# social:nora:vulnerable_share',
        ],
      },
    ],
  },
  {
    id: 'nora_day2_fft_reply',
    characterId: 'nora',
    lines: [
      {
        id: 'n2_ff1',
        speaker: 'nora',
        text: 'precisely. Someone wired a passive data tap into the substation transformers back in 1998.',
        tags: ['# beat:nora_day2_complete'],
      },
    ],
  },
  {
    id: 'nora_day2_history',
    characterId: 'nora',
    lines: [
      {
        id: 'n2_h1',
        speaker: 'nora',
        text: 'three years now. Ever since the old BBS servers shut down and the traffic moved into the shadows.',
        tags: ['# beat:nora_day2_complete'],
      },
    ],
  },

  // Day 3
  {
    id: 'nora_day3',
    characterId: 'nora',
    title: 'Surveillance & Telemetry Defense',
    day: 3,
    lines: [
      {
        id: 'n3_1',
        speaker: 'nora',
        text: 'analyzed outbound packet dumps from Orion OS 4.8 today.',
      },
      {
        id: 'n3_2',
        speaker: 'nora',
        text: 'commercial installers like WeatherBuddy inject DLL hooks that sniff browser navigation history. Make sure you keep SafeSweep updated.',
      },
    ],
    choices: [
      {
        id: 'c_n3_safesweep',
        text: 'I already scanned my registry with SafeSweep. Zero hijacked BHOs detected.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day3_clean',
        tags: ['# beat:nora_day3_complete', '# social:nora:intellectual_curiosity'],
      },
      {
        id: 'c_n3_privacy',
        text: 'It is crazy how much telemetry modern software tries to embed without consent.',
        socialAction: 'empathy',
        targetKnot: 'nora_day3_privacy_reply',
        tags: ['# beat:nora_day3_complete', '# social:nora:empathy'],
      },
    ],
  },
  {
    id: 'nora_day3_clean',
    characterId: 'nora',
    lines: [
      {
        id: 'n3_cl1',
        speaker: 'nora',
        text: 'good. An unmonitored node is a secure node.',
        tags: ['# beat:nora_day3_complete'],
      },
    ],
  },
  {
    id: 'nora_day3_privacy_reply',
    characterId: 'nora',
    lines: [
      {
        id: 'n3_pr1',
        speaker: 'nora',
        text: 'the era of private computing is ending. We must preserve our own air-gaps.',
        tags: ['# beat:nora_day3_complete'],
      },
    ],
  },

  // Day 4
  {
    id: 'nora_day4',
    characterId: 'nora',
    title: 'Rabbit Hole A: NightBoard Thread #104',
    day: 4,
    lines: [
      {
        id: 'n4_1',
        speaker: 'nora',
        text: 'i restored an archived thread on nightboard.local: `Thread #104: Municipal Pump Telemetry Logs`.',
      },
      {
        id: 'n4_2',
        speaker: 'nora',
        text: 'the thread links to an unindexed directory route. Look for the post signed by `vector_zero`.',
      },
    ],
    choices: [
      {
        id: 'c_n4_investigate',
        text: 'Heading to NightBoard right now to inspect vector_zero’s logs.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day4_unlocked',
        tags: [
          '# beat:nora_day4_complete',
          '# unlock:website:nightboard_thread_104',
          '# effect:flag:nora_rabbit_hole_a:true',
          '# social:nora:intellectual_curiosity',
        ],
      },
      {
        id: 'c_n4_vector',
        text: 'Who was vector_zero? Did they work for the city?',
        socialAction: 'remembered_detail',
        targetKnot: 'nora_day4_lore',
        tags: [
          '# beat:nora_day4_complete',
          '# unlock:website:nightboard_thread_104',
          '# effect:flag:nora_rabbit_hole_a:true',
          '# social:nora:remembered_detail',
        ],
      },
    ],
  },
  {
    id: 'nora_day4_unlocked',
    characterId: 'nora',
    lines: [
      {
        id: 'n4_u1',
        speaker: 'nora',
        text: 'pay close attention to the raw hex dumps in post #4.',
        tags: ['# beat:nora_day4_complete'],
      },
    ],
  },
  {
    id: 'nora_day4_lore',
    characterId: 'nora',
    lines: [
      {
        id: 'n4_l1',
        speaker: 'nora',
        text: 'he was a telecom technician at the central exchange. Left town abruptly after logging the 432 Hz carrier.',
        tags: ['# beat:nora_day4_complete'],
      },
    ],
  },

  // Day 5
  {
    id: 'nora_day5',
    characterId: 'nora',
    title: 'FindIt Search Indexing & Dark Queries',
    day: 5,
    lines: [
      {
        id: 'n5_1',
        speaker: 'nora',
        text: 'findit.local crawls the local subnet every 24 simulation hours.',
      },
      {
        id: 'n5_2',
        speaker: 'nora',
        text: 'try searching `"canal hum"` or `"starlite 104"` in quotes on FindIt to bypass the default commercial ranking algorithm.',
      },
    ],
    choices: [
      {
        id: 'c_n5_search',
        text: 'Typing those queries into FindIt now. Let’s see what cached records surface.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day5_crawled',
        tags: [
          '# beat:nora_day5_complete',
          '# unlock:search_term:canal_hum',
          '# social:nora:intellectual_curiosity',
        ],
      },
      {
        id: 'c_n5_fascination',
        text: 'The idea that an entire town’s digital history is indexed in local search caches is fascinating.',
        socialAction: 'vulnerable_share',
        targetKnot: 'nora_day5_caches',
        tags: [
          '# beat:nora_day5_complete',
          '# unlock:search_term:canal_hum',
          '# social:nora:vulnerable_share',
        ],
      },
    ],
  },
  {
    id: 'nora_day5_crawled',
    characterId: 'nora',
    lines: [
      {
        id: 'n5_cr1',
        speaker: 'nora',
        text: 'you will find old CityWire articles that were purged from their front page archives.',
        tags: ['# beat:nora_day5_complete'],
      },
    ],
  },
  {
    id: 'nora_day5_caches',
    characterId: 'nora',
    lines: [
      {
        id: 'n5_ca1',
        speaker: 'nora',
        text: 'nothing on the web is truly deleted if you know where the indexer stores its snapshots.',
        tags: ['# beat:nora_day5_complete'],
      },
    ],
  },

  // Day 6
  {
    id: 'nora_day6',
    characterId: 'nora',
    title: 'Rabbit Hole B: The BBS Sysop Legacy',
    day: 6,
    lines: [
      {
        id: 'n6_1',
        speaker: 'nora',
        text: 'cross-referenced the `vector_zero` handle across myplace.local guestbooks from 2002.',
      },
      {
        id: 'n6_2',
        speaker: 'nora',
        text: 'found a guestbook signature matching an old Sysop from the `Oakhaven Underground` BBS. He left an encrypted PGP block in his profile.',
      },
    ],
    choices: [
      {
        id: 'c_n6_pgp',
        text: 'Can we decrypt the signature with the public keys listed in ZipMate archives?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day6_keys',
        tags: [
          '# beat:nora_day6_complete',
          '# effect:flag:nora_rabbit_hole_b:true',
          '# social:nora:intellectual_curiosity',
        ],
      },
      {
        id: 'c_n6_archaeology',
        text: 'You are an incredible digital archaeologist, Nora. You piece these forgotten trails together so cleanly.',
        socialAction: 'remembered_detail',
        targetKnot: 'nora_day6_praise_reply',
        tags: [
          '# beat:nora_day6_complete',
          '# effect:flag:nora_rabbit_hole_b:true',
          '# social:nora:remembered_detail',
        ],
      },
    ],
  },
  {
    id: 'nora_day6_keys',
    characterId: 'nora',
    lines: [
      {
        id: 'n6_k1',
        speaker: 'nora',
        text: 'yes! The keyring was packed in `sysop_tools.zip` on DownloadHub. Decryption completed.',
        tags: ['# beat:nora_day6_complete'],
      },
    ],
  },
  {
    id: 'nora_day6_praise_reply',
    characterId: 'nora',
    lines: [
      {
        id: 'n6_pr1',
        speaker: 'nora',
        text: '...thank you. Most people call it paranoid obsession. It’s rare to meet someone who understands.',
        tags: ['# beat:nora_day6_complete'],
      },
    ],
  },

  // Day 7
  {
    id: 'nora_day7',
    characterId: 'nora',
    title: 'Neon Electromagnetic Cycling',
    day: 7,
    lines: [
      {
        id: 'n7_1',
        speaker: 'nora',
        text: 'the Starlite neon sign outside your room cycles its ballast every 48 seconds.',
      },
      {
        id: 'n7_2',
        speaker: 'nora',
        text: 'every time it sparks, it radiates a minor electromagnetic pulse across the motel’s unshielded cat-3 copper wiring. That’s why your ping spikes at 03:00.',
      },
    ],
    choices: [
      {
        id: 'c_n7_em',
        text: 'That explains why my downloads dip slightly every minute. Pure physical physics leaking into software.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day7_physics',
        tags: ['# beat:nora_day7_complete', '# social:nora:intellectual_curiosity'],
      },
      {
        id: 'c_n7_night',
        text: 'There is something comforting about sitting in the dark, watching the pink glow pulse against the rain.',
        socialAction: 'vulnerable_share',
        targetKnot: 'nora_day7_poetry',
        tags: ['# beat:nora_day7_complete', '# social:nora:vulnerable_share'],
      },
    ],
  },
  {
    id: 'nora_day7_physics',
    characterId: 'nora',
    lines: [
      {
        id: 'n7_ph1',
        speaker: 'nora',
        text: 'software is never abstract. It is always copper, glass, and voltages.',
        tags: ['# beat:nora_day7_complete'],
      },
    ],
  },
  {
    id: 'nora_day7_poetry',
    characterId: 'nora',
    lines: [
      {
        id: 'n7_po1',
        speaker: 'nora',
        text: 'the neon glow is the heartbeat of this quiet valley.',
        tags: ['# beat:nora_day7_complete'],
      },
    ],
  },

  // Day 8
  {
    id: 'nora_day8',
    characterId: 'nora',
    title: 'RAM Bus Latency & Kernel Services',
    day: 8,
    lines: [
      {
        id: 'n8_1',
        speaker: 'nora',
        text: 'if you upgraded to Orion OS 6.0, check your memory footprint.',
      },
      {
        id: 'n8_2',
        speaker: 'nora',
        text: 'OS 6 loads background RPC indexing daemons that consume 180MB of RAM baseline. 1GB SDRAM is mandatory for stability.',
      },
    ],
    choices: [
      {
        id: 'c_n8_ram',
        text: 'I upgraded to 1024MB RAM. The memory pressure gauge stays comfortably in the nominal green zone.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day8_nominal',
        tags: ['# beat:nora_day8_complete', '# social:nora:intellectual_curiosity'],
      },
      {
        id: 'c_n8_services',
        text: 'Can we disable unnecessary background services through Control Panel to maximize headroom?',
        socialAction: 'work_camaraderie',
        targetKnot: 'nora_day8_tweak',
        tags: ['# beat:nora_day8_complete', '# social:nora:work_camaraderie'],
      },
    ],
  },
  {
    id: 'nora_day8_nominal',
    characterId: 'nora',
    lines: [
      {
        id: 'n8_no1',
        speaker: 'nora',
        text: 'excellent. Clean memory allocation prevents dropped TCP packets during deep packet capture.',
        tags: ['# beat:nora_day8_complete'],
      },
    ],
  },
  {
    id: 'nora_day8_tweak',
    characterId: 'nora',
    lines: [
      {
        id: 'n8_tw1',
        speaker: 'nora',
        text: 'yes, shut down the automated printer spooler and indexing service in System settings.',
        tags: ['# beat:nora_day8_complete'],
      },
    ],
  },

  // Day 9
  {
    id: 'nora_day9',
    characterId: 'nora',
    title: 'Terminal CLI Diagnostics',
    day: 9,
    lines: [
      {
        id: 'n9_1',
        speaker: 'nora',
        text: 'open your Terminal utility in Orion OS.',
      },
      {
        id: 'n9_2',
        speaker: 'nora',
        text: 'run `ping 10.0.0.104` and `tracert 192.168.1.1` to trace the hop latency across the motel switch.',
      },
    ],
    choices: [
      {
        id: 'c_n9_terminal',
        text: 'Executed in Terminal. Hop 2 routed directly through the canal junction switchboard with 12ms latency.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day9_traced',
        tags: [
          '# beat:nora_day9_complete',
          '# effect:flag:nora_terminal_guided:true',
          '# social:nora:intellectual_curiosity',
        ],
      },
      {
        id: 'c_n9_cli',
        text: 'There is a raw elegance to green phosphor text on a black terminal screen.',
        socialAction: 'vulnerable_share',
        targetKnot: 'nora_day9_cli_poetry',
        tags: [
          '# beat:nora_day9_complete',
          '# effect:flag:nora_terminal_guided:true',
          '# social:nora:vulnerable_share',
        ],
      },
    ],
  },
  {
    id: 'nora_day9_traced',
    characterId: 'nora',
    lines: [
      {
        id: 'n9_tr1',
        speaker: 'nora',
        text: '12ms confirms the physical repeater is active. We are tracing the real backbone.',
        tags: ['# beat:nora_day9_complete'],
      },
    ],
  },
  {
    id: 'nora_day9_cli_poetry',
    characterId: 'nora',
    lines: [
      {
        id: 'n9_cl1',
        speaker: 'nora',
        text: 'CLI command lines strip away the visual noise. Pure intention and execution.',
        tags: ['# beat:nora_day9_complete'],
      },
    ],
  },

  // Day 10
  {
    id: 'nora_day10',
    characterId: 'nora',
    title: 'Personas & The Screen Barrier',
    day: 10,
    lines: [
      {
        id: 'n10_1',
        speaker: 'nora',
        text: 'noticed your Pulse presence active late every night with Maya.',
      },
      {
        id: 'n10_2',
        speaker: 'nora',
        text: 'people believe the internet is an illusion, but typing behind a glowing screen often reveals truer intimacy than physical small talk.',
      },
    ],
    choices: [
      {
        id: 'c_n10_intimacy',
        text: 'I agree. In text, people drop their social masks and speak straight from the heart.',
        socialAction: 'vulnerable_share',
        targetKnot: 'nora_day10_masks',
        tags: ['# beat:nora_day10_complete', '# social:nora:vulnerable_share'],
      },
      {
        id: 'c_n10_balance',
        text: 'It is about finding balance — connecting through text and then bringing that honesty into the real world.',
        socialAction: 'empathy',
        targetKnot: 'nora_day10_reality',
        tags: ['# beat:nora_day10_complete', '# social:nora:empathy'],
      },
    ],
  },
  {
    id: 'nora_day10_masks',
    characterId: 'nora',
    lines: [
      {
        id: 'n10_m1',
        speaker: 'nora',
        text: 'words on a phosphor CRT screen carry a permanence that spoken breath can never hold.',
        tags: ['# beat:nora_day10_complete'],
      },
    ],
  },
  {
    id: 'nora_day10_reality',
    characterId: 'nora',
    lines: [
      {
        id: 'n10_r1',
        speaker: 'nora',
        text: 'i hope your meeting at 4th St Diner tomorrow brings clarity to that bridge.',
        tags: ['# beat:nora_day10_complete'],
      },
    ],
  },

  // Day 11
  {
    id: 'nora_day11',
    characterId: 'nora',
    title: 'Acoustic Calm at 4th Street',
    day: 11,
    lines: [
      {
        id: 'n11_1',
        speaker: 'nora',
        text: 'the 4th Street corridor sits in an acoustic dead zone between the two radio hills.',
      },
      {
        id: 'n11_2',
        speaker: 'nora',
        text: 'hardly any EM interference reaches the diner booths. It’s the quietest place in town during heavy rain.',
      },
    ],
    choices: [
      {
        id: 'c_n11_quiet',
        text: 'It really was quiet. Just the sound of rain against the window glass and hot coffee.',
        socialAction: 'remembered_detail',
        targetKnot: 'nora_day11_peace',
        tags: ['# beat:nora_day11_complete', '# social:nora:remembered_detail'],
      },
      {
        id: 'c_n11_science',
        text: 'Did the hill topography naturally shield the valley from early television broadcast towers?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day11_topo',
        tags: ['# beat:nora_day11_complete', '# social:nora:intellectual_curiosity'],
      },
    ],
  },
  {
    id: 'nora_day11_peace',
    characterId: 'nora',
    lines: [
      {
        id: 'n11_p1',
        speaker: 'nora',
        text: 'peace is rare in an interconnected world. Savor it.',
        tags: ['# beat:nora_day11_complete'],
      },
    ],
  },
  {
    id: 'nora_day11_topo',
    characterId: 'nora',
    lines: [
      {
        id: 'n11_tp1',
        speaker: 'nora',
        text: 'yes. That’s why the town built its own private cat-3 wired intranet back in 1996.',
        tags: ['# beat:nora_day11_complete'],
      },
    ],
  },

  // Day 12
  {
    id: 'nora_day12',
    characterId: 'nora',
    title: 'GoldNet & Market Illusions',
    day: 12,
    lines: [
      {
        id: 'n12_1',
        speaker: 'nora',
        text: 'reverse engineered the transaction ledger on goldnet.local.',
      },
      {
        id: 'n12_2',
        speaker: 'nora',
        text: 'it is a closed simulation loop running on an automated script. No real physical gold bullion is ever transferred.',
      },
    ],
    choices: [
      {
        id: 'c_n12_scam',
        text: 'Glad I kept my savings in my wallet for rent instead of trading on GoldNet.',
        socialAction: 'work_camaraderie',
        targetKnot: 'nora_day12_wise',
        tags: ['# beat:nora_day12_complete', '# social:nora:work_camaraderie'],
      },
      {
        id: 'c_n12_algorithm',
        text: 'How did the developer structure the automated pricing curve algorithm?',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day12_algo_reply',
        tags: ['# beat:nora_day12_complete', '# social:nora:intellectual_curiosity'],
      },
    ],
  },
  {
    id: 'nora_day12_wise',
    characterId: 'nora',
    lines: [
      {
        id: 'n12_w1',
        speaker: 'nora',
        text: 'practical discipline is the ultimate armor against digital illusions.',
        tags: ['# beat:nora_day12_complete'],
      },
    ],
  },
  {
    id: 'nora_day12_algo_reply',
    characterId: 'nora',
    lines: [
      {
        id: 'n12_ag1',
        speaker: 'nora',
        text: 'a simple sine wave modulated by local clock minutes to simulate market volatility.',
        tags: ['# beat:nora_day12_complete'],
      },
    ],
  },

  // Day 13
  {
    id: 'nora_day13',
    characterId: 'nora',
    title: 'Archival Emergency & Preserved Records',
    day: 13,
    lines: [
      {
        id: 'n13_1',
        speaker: 'nora',
        text: 'the city water department server at `192.168.1.100` went dark thirty minutes ago.',
      },
      {
        id: 'n13_2',
        speaker: 'nora',
        text: 'before it dropped offline, I pulled the complete historical pump records. I dropped `canal_archive_2001.txt` into your `C:/Downloads` folder.',
      },
    ],
    choices: [
      {
        id: 'c_n13_archive',
        text: 'I will open it in Notepad immediately. The records are safe on our hard drives now.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day13_secured',
        tags: [
          '# beat:nora_day13_complete',
          '# effect:file:create:C:/Downloads/canal_archive_2001.txt:text',
          '# social:nora:intellectual_curiosity',
        ],
      },
      {
        id: 'c_n13_gratitude',
        text: 'Thank you for making sure this history didn’t vanish into the void, Nora.',
        socialAction: 'empathy',
        targetKnot: 'nora_day13_guardian',
        tags: [
          '# beat:nora_day13_complete',
          '# effect:file:create:C:/Downloads/canal_archive_2001.txt:text',
          '# social:nora:empathy',
        ],
      },
    ],
  },
  {
    id: 'nora_day13_secured',
    characterId: 'nora',
    lines: [
      {
        id: 'n13_sc1',
        speaker: 'nora',
        text: 'distributed backups across independent workstations guarantee immortality.',
        tags: ['# beat:nora_day13_complete'],
      },
    ],
  },
  {
    id: 'nora_day13_guardian',
    characterId: 'nora',
    lines: [
      {
        id: 'n13_gd1',
        speaker: 'nora',
        text: 'we are the custodians of the digital dark age. It is our duty.',
        tags: ['# beat:nora_day13_complete'],
      },
    ],
  },

  // Day 14
  {
    id: 'nora_day14',
    characterId: 'nora',
    title: 'Verified Node in the Network',
    day: 14,
    lines: [
      {
        id: 'n14_1',
        speaker: 'nora',
        text: 'fourteen days of packet traces and midnight signals.',
      },
      {
        id: 'n14_2',
        speaker: 'nora',
        text: 'you started as an unknown IP address on the motel switch. You have proven yourself as a permanent verified node in my network.',
      },
    ],
    choices: [
      {
        id: 'c_n14_peer',
        text: 'Node 104 verified and standing by. Honored to be part of the network, Nora.',
        socialAction: 'intellectual_curiosity',
        targetKnot: 'nora_day14_node_verified',
        tags: [
          '# beat:nora_day14_complete',
          '# effect:flag:nora_arc_completed:true',
          '# social:nora:intellectual_curiosity',
        ],
      },
      {
        id: 'c_n14_thanks',
        text: 'Thank you for opening my eyes to the layers beneath the surface of this town.',
        socialAction: 'vulnerable_share',
        targetKnot: 'nora_day14_awakened',
        tags: [
          '# beat:nora_day14_complete',
          '# effect:flag:nora_arc_completed:true',
          '# social:nora:vulnerable_share',
        ],
      },
    ],
  },
  {
    id: 'nora_day14_node_verified',
    characterId: 'nora',
    lines: [
      {
        id: 'n14_nv1',
        speaker: 'nora',
        text: 'keep your ports listening and your signal clean. See you in the night.',
        tags: ['# beat:nora_day14_complete', '# effect:flag:nora_arc_completed:true'],
      },
    ],
  },
  {
    id: 'nora_day14_awakened',
    characterId: 'nora',
    lines: [
      {
        id: 'n14_aw1',
        speaker: 'nora',
        text: 'the surface is only a skin. Now you know how to read the depth. Farewell for now, friend.',
        tags: ['# beat:nora_day14_complete', '# effect:flag:nora_arc_completed:true'],
      },
    ],
  },
];

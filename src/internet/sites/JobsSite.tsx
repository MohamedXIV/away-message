import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { soundManager } from '../../audio/SoundManager';

interface JobListing {
  id: string;
  title: string;
  employer: string;
  payRate: string;
  description: string;
  applied?: boolean;
}

const JOB_LISTINGS: JobListing[] = [
  {
    id: 'job_1',
    title: 'Night Shift Short-Order Cook / Counter Help',
    employer: '4th Street Diner',
    payRate: '$8.50 / hr + Tips',
    description: 'Looking for reliable late-night staff (10 PM - 6 AM). Experience with flat-top grills and coffee urns preferred. Ask for Maya or Sal.',
  },
  {
    id: 'job_2',
    title: 'Telephony & Cable Splicing Field Technician',
    employer: 'Oakhaven Telecom',
    payRate: '$14.00 / hr',
    description: 'Diagnose copper line drops and DSL bridge modems across the industrial canal district. Must have valid driver license.',
  },
  {
    id: 'job_3',
    title: 'PC Repair & Component Assembly Assistant',
    employer: 'TechMart Direct',
    payRate: '$11.00 / hr',
    description: 'Assemble custom desktop towers, test SDRAM modules, and flash BIOS chips. Immediate opening.',
  },
];

export const JobsSite: React.FC<SiteRouteProps> = () => {
  const [jobs, setJobs] = useState<JobListing[]>(JOB_LISTINGS);

  const handleApply = (jobId: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, applied: true } : j))
    );
    soundManager.play('im_send');
    alert('Application submitted! The employer will contact your Mailbox address.');
  };

  return (
    <div className="w-full min-h-full bg-white text-black font-sans text-xs p-4 flex flex-col items-center">
      {/* Header */}
      <div className="max-w-4xl w-full border-b-2 border-blue-600 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💼</span>
          <div>
            <h1 className="text-xl font-bold text-blue-900 font-serif">
              Jobs.local Classifieds
            </h1>
            <span className="text-[10px] text-gray-500">Employment Opportunities in Oakhaven & Surrounding Districts</span>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div className="max-w-4xl w-full mt-4 space-y-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="border border-gray-300 rounded p-3 flex justify-between items-start hover:border-blue-500 shadow-xs"
          >
            <div className="space-y-1 flex-1 pr-4">
              <h3 className="font-bold text-sm text-blue-950">{job.title}</h3>
              <div className="text-[11px] text-gray-700 font-semibold">
                {job.employer} — <span className="text-green-700 font-mono">{job.payRate}</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{job.description}</p>
            </div>

            <div className="shrink-0">
              {job.applied ? (
                <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-1 rounded border border-green-300">
                  ✓ Applied
                </span>
              ) : (
                <button
                  onClick={() => handleApply(job.id)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs shadow-xs cursor-pointer"
                >
                  Apply Now
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

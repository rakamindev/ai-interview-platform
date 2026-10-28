import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

export interface SkillComparison {
  skill_label: string;
  candidate_level: number;
  expected_level: number;
  result: string;
  delta: number;
}

export interface FitGapReportProps {
  report: {
    overall_score: number;
    culture_narrative: string;
    overall_narrative: string;
    skill_comparisons: SkillComparison[];
  } | null;
  isLoading: boolean;
}

const FitGapRadar: React.FC<FitGapReportProps> = ({ report, isLoading }) => {
  // 1. Monozukuri: Handling Loading State (Skeleton)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-80 bg-gray-50 rounded-xl border border-gray-100 animate-pulse">
        <p className="text-gray-400 font-medium tracking-wide">Menganalisis matriks keahlian kandidat...</p>
      </div>
    );
  }

  // 2. Monozukuri: Handling Empty/Error State
  if (!report || !report.skill_comparisons) {
    return (
      <div className="flex items-center justify-center h-80 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-gray-400 font-medium">Data metrik belum tersedia untuk kandidat ini.</p>
      </div>
    );
  }

  
  const chartData = report.skill_comparisons.map((skill) => ({
    subject: skill.skill_label,
    Kandidat: skill.candidate_level,
    Ekspektasi: skill.expected_level,
    fullMark: 5,
  }));

  // 4. Dynamic Styling berdasarkan metrik Overall Score
  const scoreColor = 
    report.overall_score >= 80 ? 'text-green-600' :
    report.overall_score >= 60 ? 'text-yellow-500' : 
    'text-red-500';

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-8 items-center">
      
      {/* Kolom Kiri: Overall Score & Executive Summary */}
      <div className="lg:w-1/3 flex flex-col justify-center items-center text-center space-y-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Overall Fit Score</h3>
        <div className={`text-7xl font-extrabold ${scoreColor}`}>
          {report.overall_score}<span className="text-3xl text-gray-300">%</span>
        </div>
        <p className="text-sm text-gray-600 mt-4 leading-relaxed bg-gray-50 p-4 rounded-lg">
          {report.overall_narrative}
        </p>
      </div>

      {/* Kolom Kanan: Radar Chart Visual */}
      <div className="lg:w-2/3 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 500 }} 
            />

            <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
            
            {/* Layer 1: Ekspektasi Peran  */}
            <Radar 
              name="Ekspektasi Peran" 
              dataKey="Ekspektasi" 
              stroke="#9ca3af" 
              fill="#9ca3af" 
              fillOpacity={0.2} 
            />
            {/* Layer 2: Performa Kandidat  */}
            <Radar 
              name="Level Kandidat" 
              dataKey="Kandidat" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fill="#3b82f6" 
              fillOpacity={0.5} 
            />
            
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' 
              }} 
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      
    </div>
  );
};

export default FitGapRadar;
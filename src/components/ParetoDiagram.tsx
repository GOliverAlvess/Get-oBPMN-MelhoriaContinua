import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ComposedChart
} from 'recharts';
import { ParetoItem } from '../types';

export default function ParetoDiagram({ data }: { data: ParetoItem[] }) {
  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.quantity - a.quantity);
    const total = sorted.reduce((sum, item) => sum + item.quantity, 0);
    
    let cumulative = 0;
    return sorted.map(item => {
      cumulative += item.quantity;
      return {
        ...item,
        percentage: (item.quantity / total) * 100,
        cumulativePercentage: (cumulative / total) * 100
      };
    });
  }, [data]);

  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-xl border border-slate-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
          />
          <YAxis 
            yAxisId="left" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#64748b' }}
            label={{ value: 'Quantidade', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12, fontWeight: 600 } }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            domain={[0, 100]} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#64748b' }}
            label={{ value: '% Acumulado', angle: 90, position: 'insideRight', style: { fill: '#64748b', fontSize: 12, fontWeight: 600 } }}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          />
          <Bar 
            yAxisId="left" 
            dataKey="quantity" 
            fill="#6366f1" 
            radius={[4, 4, 0, 0]} 
            barSize={40}
          >
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === sortedData.length - 1 ? '#94a3b8' : '#6366f1'} />
            ))}
          </Bar>
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="cumulativePercentage" 
            stroke="#f43f5e" 
            strokeWidth={3} 
            dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

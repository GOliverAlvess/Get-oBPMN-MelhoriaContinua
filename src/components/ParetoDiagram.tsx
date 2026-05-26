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

// Componente reativo que renderiza o Diagrama de Pareto (Regra 80/20) para priorização de causas
export default function ParetoDiagram({ data }: { data: ParetoItem[] }) {
  // Ordena os dados em ordem decrescente de frequência e calcula a linha de percentual acumulado
  const sortedData = useMemo(() => {
    // Clona e ordena o array de dados com base na quantidade, do maior para o menor
    const sorted = [...data].sort((a, b) => b.quantity - a.quantity);
    const total = sorted.reduce((sum, item) => sum + item.quantity, 0); // Soma total de ocorrências
    
    let cumulative = 0; // Armazena a contagem cumulativa das frequências
    return sorted.map(item => {
      cumulative += item.quantity;
      return {
        ...item,
        percentage: (item.quantity / total) * 100, // Porcentagem individual da causa
        cumulativePercentage: (cumulative / total) * 100 // Carga acumulada para a curva de Pareto
      };
    });
  }, [data]);

  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-xl border border-slate-100">
      {/* Container responsivo que ajusta automaticamente a escala do gráfico no painel */}
      <ResponsiveContainer width="100%" height="100%">
        {/* Usamos ComposedChart para combinar colunas de frequência com a linha cumulativa */}
        <ComposedChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          {/* Linha quadriculada horizontal sutil para facilitar leitura */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          
          {/* Eixo X com as categorias de ocorrência */}
          <XAxis 
            dataKey="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
          />
          
          {/* Eixo Y da Esquerda: Representa a frequência absoluta (Contagem) */}
          <YAxis 
            yAxisId="left" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#64748b' }}
            label={{ value: 'Quantidade', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12, fontWeight: 600 } }}
          />
          
          {/* Eixo Y da Direita: Representa a porcentagem acumulada (0% a 100%) */}
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            domain={[0, 100]} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#64748b' }}
            label={{ value: '% Acumulado', angle: 90, position: 'insideRight', style: { fill: '#64748b', fontSize: 12, fontWeight: 600 } }}
          />
          
          {/* Tooltip customizada flutuante inteligente */}
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          />
          
          {/* Colunas verticais conectadas ao eixo Y esquerdo (Quantidade) */}
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
          
          {/* Curva de porcentagem cumulativa conectada ao eixo Y direito (Percentual) */}
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

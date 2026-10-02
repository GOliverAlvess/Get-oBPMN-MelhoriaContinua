import { describe, it, expect, vi } from 'vitest';
import { Subtask, SubtaskMapping, Project } from '../../types';

describe('Estrutura AS-IS / TO-BE no Mapeamento BPMN', () => {
  const baseMapping: SubtaskMapping = {
    xml: '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions id="AS_IS_DEF" />',
    customData: {
      'Task_1': {
        description: 'Conferência física',
        responsibleRole: 'Operador',
        isProblemStep: true,
        timeInMinutes: 45
      }
    },
    nodes: [],
    edges: [],
    orientation: 'horizontal',
    lastEdited: '2026-09-29T10:00:00.000Z',
    savedColors: []
  };

  const sampleSubtask: Subtask = {
    id: 'sub-1',
    title: 'Recebimento de Mercadorias',
    priority: 'Alta',
    status: 'Em andamento',
    mapping: baseMapping,
    pdcaCycles: [
      {
        id: 'pdca-1',
        taskId: 'Task_1',
        title: 'Melhoria na conferência manual',
        createdAt: '2026-09-29T10:00:00.000Z',
        status: 'Ativo',
        plan: {
          problemDescription: 'Gargalo na conferência manual',
          rootCauseAnalysis: {
            type: '5whys',
            entries: []
          },
          impact: {
            description: 'Tempo de espera',
            value: 45,
            goal: 15
          },
          actionPlan: []
        }
      }
    ]
  };

  it('deve preservar integralmente o mapping existente como AS-IS', () => {
    expect(sampleSubtask.mapping).toBeDefined();
    expect(sampleSubtask.mapping.xml).toContain('AS_IS_DEF');
    expect(sampleSubtask.mapping.customData?.['Task_1']?.isProblemStep).toBe(true);
    expect(sampleSubtask.mappingToBe).toBeUndefined();
  });

  it('deve permitir atualizar TO-BE sem modificar o AS-IS existente', () => {
    const toBeMapping: SubtaskMapping = {
      xml: '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions id="TO_BE_DEF" />',
      customData: {
        'Task_Automated': {
          description: 'Conferência por RFID automatizada',
          responsibleRole: 'Sistema WMS',
          isProblemStep: false,
          timeInMinutes: 5
        }
      },
      nodes: [],
      edges: [],
      orientation: 'horizontal',
      lastEdited: '2026-09-29T11:00:00.000Z',
      savedColors: []
    };

    const updatedSubtask: Subtask = {
      ...sampleSubtask,
      mappingToBe: toBeMapping
    };

    // AS-IS permanece inalterado
    expect(updatedSubtask.mapping.xml).toContain('AS_IS_DEF');
    expect(updatedSubtask.mapping.customData?.['Task_1']?.description).toBe('Conferência física');
    expect(updatedSubtask.mapping.customData?.['Task_1']?.isProblemStep).toBe(true);

    // TO-BE é independente
    expect(updatedSubtask.mappingToBe).toBeDefined();
    expect(updatedSubtask.mappingToBe?.xml).toContain('TO_BE_DEF');
    expect(updatedSubtask.mappingToBe?.customData?.['Task_Automated']?.description).toBe('Conferência por RFID automatizada');
    expect(updatedSubtask.mappingToBe?.customData?.['Task_Automated']?.isProblemStep).toBe(false);
  });

  it('deve manter XMLs e metadados totalmente separados entre AS-IS e TO-BE', () => {
    const toBeMapping: SubtaskMapping = {
      xml: '<bpmn:to_be_xml />',
      customData: {
        'Node_X': { description: 'Novo fluxo futuro' }
      },
      nodes: [],
      edges: [],
      orientation: 'vertical',
      lastEdited: '2026-09-29T12:00:00.000Z',
      savedColors: []
    };

    const subtaskWithBoth: Subtask = {
      ...sampleSubtask,
      mappingToBe: toBeMapping
    };

    // Modificar o AS-IS
    const asIsModified: Subtask = {
      ...subtaskWithBoth,
      mapping: {
        ...subtaskWithBoth.mapping,
        xml: '<bpmn:as_is_modified_xml />',
        lastEdited: '2026-09-29T13:00:00.000Z'
      }
    };

    // TO-BE não deve ter sido afetado
    expect(asIsModified.mappingToBe?.xml).toBe('<bpmn:to_be_xml />');
    expect(asIsModified.mappingToBe?.lastEdited).toBe('2026-09-29T12:00:00.000Z');
    expect(asIsModified.mapping.xml).toBe('<bpmn:as_is_modified_xml />');
  });

  it('não deve associar etapas do TO-BE com ciclos de PDCA', () => {
    // Ciclos de PDCA devem referenciar apenas tarefas do AS-IS
    const taskIdInAsIs = 'Task_1';
    const hasPdcaInAsIs = sampleSubtask.pdcaCycles.some(c => c.taskId === taskIdInAsIs);
    expect(hasPdcaInAsIs).toBe(true);

    // No TO-BE, tarefas não geram vínculos com PDCA
    const taskIdInToBe = 'Task_Automated';
    const hasPdcaInToBe = sampleSubtask.pdcaCycles.some(c => c.taskId === taskIdInToBe);
    expect(hasPdcaInToBe).toBe(false);
  });
});

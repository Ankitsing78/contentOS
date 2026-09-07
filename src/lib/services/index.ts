/**
 * ContentOS - Service Orchestration Layer
 */

export * from './content-understanding';
export * from './research-agent';
export * from './script-agent';
export * from './production-agent';

export const ServiceLayerStatus = {
  initialized: true,
  version: '0.5.0',
  activeServices: ['ContentUnderstandingAgent', 'ResearchAgent', 'ScriptAgent', 'ProductionAgent'],
};



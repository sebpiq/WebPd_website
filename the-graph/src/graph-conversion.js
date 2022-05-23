export const theGraphToDsp = (theGraph) => {
    const dspGraph = {}
    const nodesArgs = {}
    const nodesSources = {}
    const nodesSinks = {}
  
    theGraph.initializers.forEach((initializer) => {
      const nodeId = initializer.to.node
      const argName = initializer.to.port
      const argValue = initializer.from.data
      nodesArgs[nodeId] = nodesArgs[nodeId] || {}
      nodesArgs[nodeId][argName] = argValue
    })
  
    theGraph.edges.forEach((edge) => {
      // src: {
      //   process: 'osc_1',
      //   port: '0',
      // },
      // tgt: {
      //   process: 'dac_1',
      //   port: '1',
      // },
      const sourceNodeId = edge.from.node
      const outletId = edge.from.port
      const sinkNodeId = edge.to.node
      const inletId = edge.to.port
  
      nodesSources[sinkNodeId] = nodesSources[sinkNodeId] || {}
      nodesSources[sinkNodeId][inletId] = nodesSources[sinkNodeId][inletId] || []
      nodesSources[sinkNodeId][inletId].push({ nodeId: sourceNodeId, portletId: outletId })
  
      nodesSinks[sourceNodeId] = nodesSinks[sourceNodeId] || {}
      nodesSinks[sourceNodeId][outletId] = nodesSinks[sourceNodeId][outletId] || []
      nodesSinks[sourceNodeId][outletId].push({ nodeId: sinkNodeId, portletId: inletId })
    })
  
    theGraph.nodes.forEach((theGraphNode) => {
      const nodeId = theGraphNode.id
      const type = theGraphNode.component
      const args = nodesArgs[nodeId] || {}
      const sources = nodesSources[nodeId] || {}
      const sinks = nodesSinks[nodeId] || {}
      const extraArgs = {}
      if (DEFAULT_REGISTRY[type].getIsEndSink) {
        extraArgs.isEndSink = DEFAULT_REGISTRY[type].getIsEndSink()
      }
      dspGraph[nodeId] = {
        ...extraArgs,
        id: nodeId,
        type,
        args,
        sources,
        sinks,
        inlets: DEFAULT_REGISTRY[type].buildInlets(args),
        outlets: DEFAULT_REGISTRY[type].buildOutlets(args),
      }
    })
  
    return dspGraph
  }
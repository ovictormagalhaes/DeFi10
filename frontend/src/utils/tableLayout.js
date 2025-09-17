// Utility to convert a numeric ratio array (e.g., [2,1,1,1]) into a <colgroup> element without JSX
import React from 'react'

export function ratioToColGroup(ratio) {
  if (!Array.isArray(ratio) || ratio.length === 0) return null
  const total = ratio.reduce((s,v)=>s+v,0)
  return React.createElement(
    'colgroup',
    null,
    ratio.map((v,i)=> {
      const w = (v/total*100).toFixed(3) + '%'
      return React.createElement('col', { key: i, style: { width: w } })
    })
  )
}

import Link from 'next/link';
import type {DashboardAction} from '../lib/dashboard-actions';

export default function DashboardActionQueue({actions,loading,incomplete}:{
 actions:DashboardAction[];
 loading:boolean;
 incomplete:boolean;
}){
 return <section aria-labelledby="dashboard-task-heading" aria-busy={loading}>
  <h2 id="dashboard-task-heading" className="dashboard-section-title">Tasks and updates</h2>
  {incomplete&&<p className="notice" role="status">Some tasks are temporarily unavailable. Refresh the dashboard to try again.</p>}
  {actions.length>0?<ul className="dashboard-activity-list" style={{listStyle:'none',padding:0}}>
   {actions.map(action=><li key={action.id}>
    <Link className="dashboard-activity-row" href={action.href}>
     <span aria-hidden="true">{action.priority==='attention'?'!':'•'}</span>
     <span><strong>{action.title}</strong><small>{action.description}</small></span>
     <span className="pill">{action.priority==='attention'?'Action needed':'Update'}</span>
    </Link>
   </li>)}
  </ul>:loading?<p className="muted-note" role="status">Checking your tasks…</p>:
   !incomplete&&<p className="card dashboard-empty">You’re caught up on your recent tasks.</p>}
 </section>;
}

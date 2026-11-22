import {safeNotificationTarget} from './notification-target';

export type DashboardAction={
  id:string;
  title:string;
  description:string;
  href:string;
  priority:'attention'|'update';
};

type StatusRow={id:string;status:string};
type DashboardActionInput={
  view:'customer'|'professional';
  userId:string;
  jobs:readonly (StatusRow&{title:string})[];
  bookings:readonly (StatusRow&{customer_id:string;professional_id:string})[];
  applications:readonly StatusRow[];
};

export function buildDashboardActions({view,userId,jobs,bookings,applications}:DashboardActionInput):DashboardAction[]{
  if(!userId)return [];

  const isCustomer=view==='customer';
  const bookingActions=bookings
    .filter(booking=>isCustomer
      ?booking.customer_id===userId&&booking.status==='awaiting_customer'
      :booking.professional_id===userId&&booking.status==='booked')
    .map((booking):DashboardAction=>({
      id:'booking-'+booking.id,
      title:isCustomer?'Confirm completed work':'Manage an active booking',
      description:isCustomer?'Review the professional’s completion update.':'Review the booking and agree the next step with your customer.',
      href:safeNotificationTarget('/bookings?booking='+booking.id)??'/bookings',
      priority:'attention'
    }));

  const updates=isCustomer
    ?jobs.filter(job=>job.status==='open').map((job):DashboardAction=>({
      id:'job-'+job.id,
      title:job.title,
      description:'Open for quotes. Check for replies or manage your job request.',
      href:'/jobs',
      priority:'update'
    }))
    :applications.filter(application=>application.status==='pending'||application.status==='under_review')
      .map((application):DashboardAction=>({
        id:'application-'+application.id,
        title:'Track your trade application',
        description:application.status==='pending'?'Awaiting independent review.':'Your application is under review.',
        href:'/professional/apply',
        priority:'update'
      }));

  const unique=new Map<string,DashboardAction>();
  for(const action of [...bookingActions,...updates]){
    if(!unique.has(action.id))unique.set(action.id,action);
    if(unique.size===6)break;
  }
  return [...unique.values()];
}

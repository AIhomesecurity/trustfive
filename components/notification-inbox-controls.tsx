import {inboxCategories,type InboxFilter,type InboxCategory} from '../lib/notification-inbox';

type Props={
  filter:InboxFilter;
  category:InboxCategory;
  search:string;
  unreadCount:number;
  onFilterChange:(filter:InboxFilter)=>void;
  onCategoryChange:(category:InboxCategory)=>void;
  onSearchChange:(search:string)=>void;
  onReset:()=>void;
};

export default function NotificationInboxControls({
  filter,category,search,unreadCount,onFilterChange,onCategoryChange,onSearchChange,onReset
}:Props){
  const hasFilters=filter!=='all'||category!=='all'||search.length>0;
  return <div className="card">
    <p role="status">{unreadCount} unread in your most recent notifications</p>
    <div style={{display:'grid',gap:12,gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,12rem),1fr))'}}>
      <label>Read status
        <select value={filter} onChange={event=>onFilterChange(event.target.value as InboxFilter)}>
          <option value="all">All notifications</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </label>
      <label>Category
        <select value={category} onChange={event=>onCategoryChange(event.target.value as InboxCategory)}>
          {inboxCategories.map(({value,label})=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Search recent notifications
        <input type="search" value={search} onChange={event=>onSearchChange(event.target.value)}/>
      </label>
    </div>
    <button type="button" className="btn secondary" style={{marginTop:12}} disabled={!hasFilters} onClick={onReset}>Clear filters</button>
  </div>;
}

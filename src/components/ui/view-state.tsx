export function ViewState({title,description,children,busy=false}:{title:string;description:string;children?:React.ReactNode;busy?:boolean}){
 return <main className="message-page view-state" aria-busy={busy}><span className="empty-leaf" aria-hidden="true">✳</span><h1>{title}</h1><p role={busy?'status':undefined}>{description}</p>{children}</main>;
}

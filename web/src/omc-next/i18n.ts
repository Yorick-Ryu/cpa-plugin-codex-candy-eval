export const useT=()=> (key:string)=>({"common.all":"全部","common.close":"关闭","common.cancel":"取消","common.confirm":"确认","common.page":"页","common.previous":"上一页","common.next":"下一页"}[key]??key);
export const languageLocale=(_:string)=>"zh-CN";
export const useI18n=()=>({t:useT(),lang:"zh"});

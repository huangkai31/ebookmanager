var status_names=new Array("","Reading", "Read", "Going to Read");
    
$(function() {
    $( "#tabs" ).tabs();
    
    init();
    
    $("#button_add_new_folder").click(function(){
        Ti.UI.currentWindow.openFolderChooserDialog(function(dir){
            if( dir.length){
                //alert(dir[0]);
                Ti.API.info("Adding folder:"+dir[0]);
                var db = get_database();
                db.execute("insert into directory values('"+dir[0]+"')");
                db.close();
                
                update_folder_list();
            }
        } );        
    });
    
    $("#button_remove_folder").click(function(){
        var folder= $("#folders").val();
        if( folder){
            Ti.API.info("Removing folder:"+ folder);
            remove_folder(folder);
        }else{
            alert('Please select a folder from the list!') ;
        }
        
    });
    
    $("#button_scan_folder").click(function(){
        var folder= $("#folders").val();
        if( folder){
            Ti.API.info("Scanning folder:"+ folder);
            var worker= Ti.Worker.createWorker(scan_folder_worker);
            worker.postMessage(folder);
            worker.onmessage= function(event){
                if( event.message.status ==1 ){
                    $("#button_scan_folder").attr("disabled","disabled");
                } else if( event.message.status==0){
                    $("#button_scan_folder").removeAttr("disabled");     
                }
                $("#message").text(event.message.message);
            };
            worker.start();
            
        }else{
            alert('Please select a folder from the list!') ;
        }
    });
    
    $("#search_text").keyup(function(event){
        if( event.keyCode==13){
            $("#button_search_book").click();
        }
    });
    
    $("#button_search_book").click(function(){
        var search_text= $("#search_text").val();
        var search_status= $("#search_status").val();
        
        var sql="select * from book where id>0 ";
        if(search_text.length >0 ){
            sql+="and ("
            sql+=" path like '%"+search_text+"%' ";
            sql+=" or name like '%"+search_text+"%' ";
            sql+=" or tags like '%"+search_text+"%' ";
            sql+=") ";
        }
        
        if( search_status >0){
            sql+=" and status="+search_status;
        }
        if( $("#search_favor").prop("checked")==true ){
            sql+=" and isfavor=1 ";
        }
        
        sql+=" order by name, isfavor, status"    
        Ti.API.info(sql);
        
        //clear the table
        $("#table_search_result").jqGrid('clearGridData'  );
        
        var db = get_database();
        var rows= db.execute(sql);
        while(rows.isValidRow() ){
            //append the book to the table
            $("#table_search_result").jqGrid('addRowData', rows.fieldByName("id"), 
                {
                    "id": rows.fieldByName("id"),
                    "name": unescape(rows.fieldByName("name")),
                    "path": rows.fieldByName("path"),
                    "status": status_names[rows.fieldByName("status")],
                    "favor": rows.fieldByName("isfavor")>0?"Yes":"No",
                    "tags": rows.fieldByName("tags")
                });
            rows.next();
        }
        $("#table_search_result").trigger("reloadGrid");
        rows.close();
        db.close();
        
        
    });
    
    $("#button_open_book").click(function(){
        open_book( $("#book_id").val());
    });
    
    $("#button_save_book").click(function(){
        //save into database
        var db= get_database();
        var id= $("#book_id").val();
        var sql=  "update book set ";
        if( $("#book_favor").prop("checked")==true ){
            sql+=" isfavor=1 ";
        }else{
            sql+=" isfavor=0 ";
        }
        
        sql+=" , status="+$("#book_status").val();
        if( parseInt( $("#book_page").val())>0 )
            sql+=" , page="+parseInt( $("#book_page").val());
        else
            sql+=" , page=0";
        
        sql+=", tags='"+$("#book_tags").val()+"'";
        sql+=", comment='"+$("#book_comment").val()+"'"; 
          
        sql+=" where id="+id;    
        Ti.API.info(sql);
        db.execute(sql);      
        
        
        //update row data
        var rows= db.execute("select * from book where id="+id);
        if( rows.isValidRow()){
            $("#table_search_result").jqGrid('setRowData', id,{
                    "id": rows.fieldByName("id"),
                    "name": unescape(rows.fieldByName("name")),
                    "path": rows.fieldByName("path"),
                    "status": status_names[rows.fieldByName("status")],
                    "favor": rows.fieldByName("isfavor")>0?"Yes":"No",
                    "tags": rows.fieldByName("tags")
                });
        }
        rows.close();
        db.close();         
    });
});


function init(){
    //set window title
    var userwindow = Ti.UI.currentWindow;
    userwindow.setTitle("ebook manager");

    //create database if not exist
    var db = get_database();
    db.execute("create table if not exists directory( name text primary key)");  
    db.execute("create table if not exists book(id integer primary key, root text, path text, name text, extension text, status integer, isfavor integer, tags text, touch integer, page integer, comment text)"); 
    db.execute("create unique index if not exists book_index on book (path, name) " );                                        
    db.close();
    
    update_folder_list();
    
    //jqgrid
    $("#table_search_result").jqGrid({
        datatype: "local",
        height: 230, width:780,
        colNames:['ID','Name','Path', 'Status', 'Favor', 'Tags'],
        colModel:[
            {name:'id', hidden:true},
            {name:'name', width:500},
            {name:'path', width:100},
            {name:'status', width:50},
            {name:'favor', width:30},
            {name:'tags', width:100}                
            
        ],
        rowNum: 10,
        pager: "#table_search_result_pager",
        ondblClickRow: function(id){
            Ti.API.debug(id); 
            open_book(id);   
        },
        onSelectRow: function(id){
            //update book detail
            get_book_detail(id);
        },
        caption: "Search Result"
    });
    
}
function get_book_detail(id){
    var db= get_database();
    var rows= db.execute("select * from book where id="+id);
    if( rows.isValidRow()){
        $("#div_book_detail").show();
        $("#book_id").val( rows.fieldByName("id"));    
        $("#book_name").text( unescape(rows.fieldByName("name")));
        $("#book_path").text( unescape(rows.fieldByName("path")));
        
        if( rows.fieldByName("isfavor") >0)
            $("#book_favor").attr("checked", true);
        else
            $("#book_favor").removeAttr('checked');
             
        $("#book_status").val( rows.fieldByName("status"));
        
        $("#book_page").val( rows.fieldByName("page"));
        $("#book_tags").val( rows.fieldByName("tags"));
        $("#book_comment").val( rows.fieldByName("comment"));
        
    }
    rows.close();
    db.close();
}

function open_book(id){
    var db= get_database();
    var rows= db.execute("select * from book where id="+id);
    if( rows.isValidRow()){
        var file= rows.fieldByName("path")+ Ti.Filesystem.getSeparator()+ unescape(rows.fieldByName("name"));
        Ti.API.info("Opening:"+file);
        try{
            var result=Ti.Platform.openApplication(file);
            Ti.API.info("Opened:"+result);
        }catch(err){
            Ti.API.info(err);
        }     
    }
    rows.close();        
    db.close();
}

function get_database(){
    return Ti.Database.openFile(Ti.Filesystem.getFile(
                              Ti.Filesystem.getApplicationDataDirectory(), 'ebooks.db'));
}

function update_folder_list(){
    var db = get_database();
    var rows = db.execute("select * from directory");
    $("#folders").empty();
    while( rows.isValidRow()){
        Ti.API.info("Directory:"+ rows.fieldByName("name"));
        $("#folders").append("<option>"+rows.fieldByName("name")+"</option>");            
        rows.next();
    }
    rows.close();
    db.close();
}

function remove_folder(folder){
    var db = get_database();
    db.execute("delete from directory where name='"+folder+"'");
    //remove books from the database as well
    db.execute("delete from book where root='"+folder+"'");
    
    update_folder_list();
    var notification = Ti.Notification.createNotification({
        'title' : 'Notice',
        'message' : 'Folder: '+folder+" removed",
        'timeout' : 10
        
            
    });
    
    notification.show();
}



function scan_folder_worker(){
    this.get_database= function(){
        return Ti.Database.openFile(Ti.Filesystem.getFile(
                                  Ti.Filesystem.getApplicationDataDirectory(), 'ebooks.db'));
    };
    
    this.db= this.get_database();
    this.root_folder="";
    
    this.status_message="";
    
    this.file_scanned=0;
    this.file_new=0;
    this.file_existing=0;
    this.file_removed=0;
    this.get_stats= function(){
        return " Scanned:"+this.file_scanned+" New:"+this.file_new+" Existing:"+this.file_existing+" Removed:"+this.file_removed;
    };
                              
    this.onmessage= function(event){
        this.root_folder=event.message;
        //Ti.API.info("Scaning:"+this.root_folder);
        this.status_message="Scanning "+this.root_folder;
        this.postMessage({"status":1, "message": this.status_message });
        
        var db= this.db;
        db.execute("update book set touch=0 where root='"+this.root_folder+"'");
        
        //step 1: scan files to insert
        this.scan_folder( this.root_folder, this);
        
        //step 2: remove those books that touch=0
        db.execute("delete from book where touch=0");
        this.file_removed= db.rowsAffected;
        db.close();
        this.status_message="Scan finished "+this.root_folder;            
        this.postMessage({"status":0, "message":this.status_message+this.get_stats()});
           
    };
    
    this.scan_folder=function(folder, parent){
        //parent.postMessage({"status":2, "message":"Scanning:"+folder+parent.get_stats()});
        var ebook_extensions= "pdf,chm";
        var db= parent.db;
        var dir =  Ti.Filesystem.getFile(folder);
        var files= dir.getDirectoryListing();
        for(var i=0; i< files.length; i++ ){
            
            
            if( files[i].isFile()){
                parent.file_scanned++;
                
                if( file_scanned % 100 ==0){
                    //parent.postMessage({"status":2, "message":"Scanning:"+folder+parent.get_stats()});    
                }
                
                Ti.API.info("File:"+ files[i].name());
                
                //decide if it is a ebook: pdf, chm
                if( ebook_extensions.indexOf( files[i].extension()) >=0){                    
                
                    //add the file to database
                    try{
                        //find if the file already exist
                        var rows= db.execute("select id from book where path='"+folder+"' and name='"+ escape(files[i].name())+"' ");
                        if( rows.isValidRow()){
                            parent.file_existing++;
                            //existing book
                            var id= rows.fieldByName("id");
                            Ti.API.info("Exist "+id+ " "+ escape(files[i].name())); 
                            db.execute("update book set touch=1 where id="+id);
                               
                        }else{
                            // new book
                            parent.file_new++;
                            db.execute("insert into book(root, path, name, extension, status, isfavor, touch) values('"+parent.root_folder+"', '"+folder+"','"+ escape(files[i].name())+"', '"+files[i].extension()+"', 0, 0, 1)");
                        }
                        rows.close();
                    }catch(err){
                        Ti.API.error( err);
                    }
                }
                
            }else if( files[i].isDirectory()){
                Ti.API.info("Dir:"+files[i]);
                parent.scan_folder( files[i].nativePath(), parent);
            }
            
        }
    };
    
}

function scan_folder(folder){
    Ti.API.info( folder);
    var dir =  Ti.Filesystem.getFile(folder);
    var files= dir.getDirectoryListing();
    for(var i=0; i< files.length; i++ ){
        Ti.API.info( files[i]);
    }
}
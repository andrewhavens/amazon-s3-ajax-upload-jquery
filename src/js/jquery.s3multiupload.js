(function($){
	$.fn.s3_multiupload = function( settings ) {
		var config = {
			text: null, // Defaults to the previous value of content of the element
			path: "/s3_multiupload.swf",
			prefix: "",
			element: '<div />',
			signature_url: "/s3upload",
			required: true,
			submit_on_all_complete: true,
			error_class: "s3_error",
			file_types: [],
			multi: true,
			queue_size: 3
		};
		if( settings ) $.extend( config , settings );

		// TODO Define settings for the default visuals (like progress percentage or bar)

		// if any element is a form find all :file inputs inside instead.
		var elements = this.map( function() {
			if( $(this).is("form") )
				return $(this).find(":file").toArray();
			return $(this);
		} );

		$.fn.s3_multiupload.instances = $.fn.s3_multiupload.instances || [];
		var started = 0;
		var completed = 0;
		
		return elements.each( function() {
			var form = $(this).closest("form");
			var id = $(this).attr("id") || "s3_multiupload_" + $.fn.s3_multiupload.instances.length;
			var name = $(this).attr("name");
			
			// Ignore already created instances
			if( $.inArray( id , $.fn.s3_multiupload.instances ) != -1 )
				return;
	
			// replace the file input  
			var el = $(config.element);
			el.attr( { 
				id: id,
				"class": $(this).attr("class") 
			});
			$(this).replaceWith(el);
			
			// Find the value of the original to use (useful for when a previous "upload" exists)
			var val = config.text;
			if( !val ) {
				if( $(this).is(":file") )
					val = $(this).attr("defaultValue");
				else if( $(this).is("input") )
					val = $(this).val();
				else
					val = $(this).html();
			}
			
			// A helper method to set the value, even if it's an input element
			var setValue = function(v) {
				if( el.is("input") )
					el.val(v);
				else
					el.html(v);
			}
			
			// create a div for the transparent flash button and absolute position it above the created element.
			var flash_div = $( "<div id='s3_multiupload_"+id+"'><div id='flash_"+id+"'></div></div>" ).appendTo( "body" );
	
			// "Serialize" the filters
			var filters = $.map( config.file_types , function(f,i) { return f.join("#"); }).join("|");
	
			// Instantiate a swfobject in that div with js callbacks for selected, start, cancel, progress, error and complete
			var fv = { 
				id: "flash_"+id,
				prefix: config.prefix,
				signatureURL: config.signature_url,
				filters: filters,
				queue_size: config.queue_size
			};
			
			var params = { wmode: "transparent" , menu: false };
		  swfobject.embedSWF(config.path, fv.id, "100%", "100%", "9.0.0" , false, fv, params, false, function(e){
				if( e.success ) {
					var swf = e.ref;
					
					// Now that the flash has been initialized, show the initial text
					setValue(val);
					
					// Position the swf on top of the element (and keep it positioned)
					swf.update_interval = setInterval( function(){
						var pos = el.offset();
						flash_div.css({
							width: el.outerWidth(),
							height: el.outerHeight(),
							position: "absolute",
							top: pos.top,
							left: pos.left
						});
					} , 100 );
					
					// add a submit listener to the elements form which starts the upload in the flash instances.
					var formSubmit = function(e){
						if( config.required && !swf.info )
							swf.onerror( "Error: No file selected." );
						else if( swf.info )
							swf.upload();
						return false;
					}
					
					// Create SWF-JS callbacks
					swf.onenabled = function() {
						if( $.isFunction( config.onenabled ) )
							config.onenabled.call(el);
						
					}
					swf.ondisabled = function() {
						if( $.isFunction( config.ondisabled ) )
							config.ondisabled.call(el);
						form.unbind("submit",formSubmit);
					}
					swf.onmouseevent = function(type,x,y) {
						var def = true;
						if( $.isFunction( config["on"+type] ) )
							def = config["on"+type].call(el,x,y);
						if( def ) {
							// Do default stuff: Run the regular dom events on "el"?
							el.trigger(type);
						}
					}
					swf.onselect = function(val) {
						var args = Array.prototype.slice.call(arguments); 
						var array = [];
						var def = true;
						$.each(args, function(i, val){
							array.push( {name: val[0], size: val[1], type:val[2]});
						});
						console.log(array);
						if( $.isFunction( config.onselect ) )
							def = config.onselect.call(el,array);
						if( def ) {
							// Do default stuff: Replace the text of the div with the filename?
							// setValue(config.prefix + name);
						}
						
						$.each(array, function(i, val){
							swf.info = {name: val.name, size: val.size, type: val.type};
							form.data("s3_selected",(form.data("s3_selected")||0) + 1 );
						})
						form.submit(formSubmit);
					}
					swf.ontrace = function(msg){
						console.log(msg);
					}
					swf.oncancel = function() {
						var def = true;
						if( $.isFunction( config.oncancel ) )
							def = config.oncancel.call(el,swf.info);
						if( def ) {
							// Do default stuff: Show a message? Go back to "Select file..." text?
							setValue(val);
						}
						swf.info = null;
					}
					swf.onstart = function() {
						var def = true;
						if( $.isFunction( config.onstart ) )
							def = config.onstart.call(el,swf.info);
						if( def ) {
							// Do default stuff: Replace the text of the div?
						}
						if( $.isFunction( swf.disable ) )
							swf.disable();
					}
					swf.onprogress = function(p) {
						var def = true;
						key = Array.prototype.slice.call(arguments).pop();
						key = key.split('/').pop();
						key.replace(/[\s.]+/g, '-');
						if( $.isFunction( config.onprogress ) )
							def = config.onprogress.call(el,p,key,swf.info);
						if( def ) {
							// Do default stuff: Fill the background of the div?
							//setValue( Math.ceil( p * 100 ) + "%" );
						}
					}
					swf.onerror = function(msg) {
						var def = true;
						if( $.isFunction( config.onerror ) )
							def = config.onerror.call(el,msg,swf.info);
						if( def ) {
							// Do default stuff: Replace the text with the error message?
							if( !el.is("input") )
								setValue( "<span class='"+config.error_class+"'>" + msg + "</span>" );
							else
								setValue( msg );
						}
						if( $.isFunction( swf.enable ) )
							swf.enable();
					}
					swf.oncomplete = function(key) {
						// Add the key to the info object
						swf.info.key = key;
						
						var def = true;
						if( $.isFunction( config.oncomplete ) )
							def = config.oncomplete.call(el,swf.info);
						if( def ) {
							// Do default stuff...
						}
						
						// Add to the total upload complete counter, and if it matches the number of uploads we submit the form.
						form.data("s3_completed",(form.data("s3_completed")||0) + 1 );
					
						var done = form.data("s3_completed") / form.data("s3_selected");
					
						// All Done! Do a regular form submit or just re-enable the flash.
						if( done == 1 ) {
							swf.onallcomplete();
						}
					}
					swf.onallcomplete = function(){
						if( $.isFunction( config.onallcomplete ) )
							def = config.onallcomplete.call(el,swf.info);
						if( def ) {
							if( !config.submit_on_all_complete ) {
								if( $.isFunction( swf.enable ) )
									swf.enable();
							} else {
								form.unbind();
								form.submit();
							}
						}
						else{
							
						}
					}
					
				}
			});
			$.fn.s3_multiupload.instances.push( id );
		} );
	};
})(jQuery);
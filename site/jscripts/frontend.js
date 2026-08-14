jQuery.preloadImages = function(){
  for(var i = 0; i<arguments.length; i++){
    jQuery("<img>").attr("src", arguments[i]);
  }
}

jQuery.fn.labelOver = function(overClass) {
	return this.each(function(){
		var label = jQuery(this);
		var f = label.attr('for');
		if (f) {
			var input = jQuery('#' + f);
			
			this.hide = function() {
			  label.css({ textIndent: -10000 })
			}
			
			this.show = function() {
			  if (input.val() == '') label.css({ textIndent: 0 })
			}

			// handlers
			input.focus(this.hide);
			input.blur(this.show);
		    label.addClass(overClass).click(function(){ input.focus() });
			
			if (input.val() != '') this.hide(); 
		}
	})
}

function openPageOptionsPage(){
    tb_show('Page Options', '/page_options.php?tb_type=cms_header_nav&TB_iframe=true&height=500&width=770', null);
}

function openSettingsPage(uri){
    tb_show('Settings', uri + '&TB_iframe=true&height=500&width=770', null);
}

function openMessage(message_id){
    tb_show('Settings','/settings/view_message.php?id='+message_id+'&TB_iframe=true&height=500&width=770', null);
}

function editItem(tburl,tbtitle){
    if(tbtitle == undefined){
        var tbtitle = 'Edit';
    }
	tb_show(tbtitle, tburl, null);
}

function unsetAllBorders() {
    $(".cms_editable").removeClass('cms_editable_hover');
	$(".cms_edit_box-js").remove();
}

jQuery(document).ready(function() {
    var elem = jQuery('[data-edit-url]').addClass('thickbox cms_editable');
    elem.each(function() {
        jQuery(this).attr('alt', jQuery(this).attr('data-edit-text'));
        jQuery(this).click(function() {
            editItem(jQuery(this).attr('data-edit-url'), jQuery(this).attr('data-edit-text'));
        });
    });
});

jQuery(document).ready(function() {
    // login
    // if(cmsLogin == 1){
    //     tb_show('Login','/cms_login.php?TB_iframe=true&amp;height=500&amp;width=770', null);
    // }
    
    // hover control
/*    if(showEdits == 0){
        jQuery('.cms_editable').hover(function(){
            var title = $(this).attr('alt');
            if(title == '' || title == undefined){
                title = "Edit";
            }
    		jQuery(this).addClass('cms_editable_hover').prepend("<div class='cms_edit_box-js'><span class='title-js'>"+title+"</span></div>");
    	},function(){
    		jQuery(this).removeClass('cms_editable_hover');
    		jQuery(".cms_edit_box-js").remove();
    	});
    }else if(showEdits == 1){
        jQuery('.cms_editable').each(function(){
            var title = $(this).attr('alt');
            if(title == '' || title == undefined){
                title = "Edit";
            }
    		jQuery(this).addClass('cms_editable_hover').prepend("<div class='cms_edit_box-js'><span class='title-js'>"+title+"</span></div>");
    	});
    }*/
    
    jQuery('.cms_mail_to').each(function(){
        var email = jQuery(this).attr('address');
        var email2 = email.replace(' [dot] ','.');
        var true_email = email2.replace(' [at] ','@');
        var title = jQuery(this).attr('title');
        if(title == ''){
            jQuery(this).after("<a href=\"mailto:"+true_email+"\">"+true_email+"</a>").remove();
        }else{
            jQuery(this).after("<a href=\"mailto:"+true_email+"\">"+title+"</a>").remove();
        }
    });
    jQuery('.cms_mail_to_ao').each(function(){
        var email = jQuery(this).html();
        var email2 = email.replace(' [dot] ','.');
        var true_email = email2.replace(' [at] ','@');
        jQuery(this).after("<a href=\"mailto:"+true_email+"\">"+true_email+"</a>").remove();
    });
});

jQuery(document).ready(function(){
    jQuery('.jquery_embed_swf').each(function(){
        var src = jQuery(this).attr('src');
        var width = jQuery(this).attr('vwidth');
        var height = jQuery(this).attr('vheight');
        jQuery(this).flash({ src: src,width: width,height: height },{ version: 8 });
    });
});


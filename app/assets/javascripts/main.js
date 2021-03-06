$(document).on('ready', function() {
  
  $('.post-submit').on('click', function() {
    var internet  = navigator.onLine,
        postData  = $('#new-post').serializeArray(),
        author    = postData[0].value,
        location  = postData[1].value,
        topic     = postData[2].value,
        message   = postData[3].value,
        origin    = "";
    if (internet == true) {
      origin = 'Postgres';
      normalSubmit(author, location, topic, message, origin);
    } else {
      origin = 'Web-storage';
      addPost(author, location, topic, message, origin);
    }
    document.getElementById('new-post').reset();
  });

  $('.sync-database').on('click', function () {
    var internet  = navigator.onLine,
        notice   = 'Cannot sync databases without an internet connection. Please connect to the internet and try again!';
    if (internet == true) {
      syncDatabase();
    } else {
      flashNotice(notice);
    }
  });

  // Start of database interaction

  const DB_NAME = 'no-internet-prototype';
  const DB_VERSION = 1;
  const DB_STORE_NAME = 'posts';

  var db;

  function openDb() {
    // console.log('openDb...')
    var request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = function(event) {
      // Better use "this" than "req" to get the result to avoid problems with
      // garbage collection.
      // db = request.result;
      db = this.result;
      displayPosts();
      // console.log('openDb is done')
    };

    request.onerror = function(event) {
      console.error("Database error: " + event.target.errorCode);
    };

    request.onupgradeneeded = function(event) {
      var store = event.currentTarget.result.createObjectStore(
        DB_STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
  }

  function getObjectStore(store_name, mode) {
    var tx = db.transaction(store_name, mode);
    return tx.objectStore(store_name);
  }

  function displayPosts() {
    var internet  = navigator.onLine;
    if (internet == true) {
      databasePosts();
      webStoredPosts();
    } else {
      webStoredPosts();
    }
  };

  function webStoredPosts(store) {
    $('#user-list').empty();

    if (typeof store == 'undefined') {
      store = getObjectStore(DB_STORE_NAME, 'readonly');
    }

    var request = store.openCursor()

    request.onsuccess = function(event) {
      var cursor = event.target.result;

      if (cursor) {
        var key       = cursor.key,
            author    = cursor.value.author,
            location  = cursor.value.location,
            topic     = cursor.value.topic,
            message   = cursor.value.message,
            origin    = cursor.value.origin;
        appendPost(key, author, location, topic, message, origin);
        cursor.continue();
      } else {
        // No more data entries
      }
    }
  };

  function addPost(author, location, topic, message, origin) {
    var obj     = { author: author, location: location, topic: topic, message: message, origin: origin},
        store   = getObjectStore(DB_STORE_NAME, 'readwrite'),
        request = store.add(obj);

    request.onsuccess = function(event) {
      var notice    = 'Your post has been successfully added to web storage!';
          key       = event.target.result,
          author    = obj.author,
          location  = obj.location,
          topic     = obj.topic,
          message   = obj.message,
          origin    = obj.origin;
      appendPost(key, author, location, topic, message, origin);
      flashNotice(notice);
    };
    request.onerror = function(event) {
      console.error('error');
    };
  };

  function deletePost(key, store) {

    if (typeof store == 'undefined') {
      store = getObjectStore(DB_STORE_NAME, 'readwrite');
    }

    // As per spec http://www.w3.org/TR/IndexedDB/#object-store-deletion-operation
    // the result of the Object Store Deletion Operation algorithm is
    // undefined, so it's not possible to know if some records were actually
    // deleted by looking at the request result.
    var request = store.get(key);

    request.onsuccess = function(event) {
      var record = event.target.result;

      // Warning: The exact same key used for creation needs to be passed for
      // the deletion. If the key was a Number for creation, then it needs to
      // be a Number for deletion.
      request = store.delete(key);

      request.onsuccess = function(event) {
        $('#'+key).hide();
      };
      request.onerror = function (event) {
        console.error("deletePost:", event.target.errorCode);
      };
    };

    request.onerror = function (event) {
      console.error("deletePost:", event.target.errorCode);
      };
  }

  function syncDatabase() {
    if (typeof store == 'undefined') {
      store = getObjectStore(DB_STORE_NAME, 'readonly');
    }
    var request = db.transaction('posts').objectStore('posts').openCursor()

    request.onsuccess = function(event) {
      var cursor = event.target.result;
      if (cursor) {    
        var author    = cursor.value.author,
            location  = cursor.value.location,
            topic     = cursor.value.topic,
            message   = cursor.value.message,
            origin    = cursor.value.origin;
        normalSubmit(author, location, topic, message, origin);
        deletePost(cursor.key);
        cursor.continue();
      } else {
        // No more data entries
      }
    }
  }
  
  openDb();

});

function normalSubmit(author, location, topic, message, origin) {
  var datastring  = {author: author, location: location, topic: topic, 
                     message: message, origin: origin},
      notice     = 'Your post has been successfully added to the database!';
  $.ajax({
      type: 'POST',
      data: datastring,
      dataType: 'json',
      url: '/posts',
        success: function(data) {
          var id        = data.new_post.id,
              author    = data.new_post.author,
              location  = data.new_post.location,
              topic     = data.new_post.topic,
              message   = data.new_post.message,
              origin    = data.new_post.origin;
          appendPost(id, author, location, topic, message, origin);
          flashNotice(notice);
        }
    });
};

function databasePosts() {
  $.ajax({
    type: 'GET',
    dataType: 'json',
    url: '/posts/get_list_of_posts',
      success: function(data) {
        $.each(data.posts, function () {
          var id        = this.id,
              author    = this.author,
              location  = this.location,
              message   = this.message,
              topic     = this.topic,
              origin    = this.origin;
          appendPost(id, author, location, topic, message, origin);
        });
      }
  });
};

function flashNotice(noticeMessage) {
  var notice       = "";
      notice      +=  '<div class="notice alert alert-warning alert-dismissable fade in" role="alert">',
      notice      +=  ' <button type="button" class="close" data-dismiss="alert" aria-label="Close">',
      notice      +=  '   <span aria-hidden="true">&times;</span>',
      notice      +=  ' </button>',
      notice      +=  ' <p><strong>Notice: </strong>'+noticeMessage+'</p>',
      notice      +=  '</div>';
  $('.notice-box').append(notice);
  // Find a wasy to count notices, then display the number in a badge
};

function appendPost(id, author, location, topic, message, origin) {
  var post  = "";
      post += '<div class="panel panel-default" id="'+id+'">',
      post += '  <div data-toggle="collapse" data-parent="#accordion" href="#collapse'+id+'" aria-expanded="true" aria-controls="collapse'+id+'" class="panel-heading" role="tab" id="heading'+id+'">',
      post += '    <h4>'+topic+'</h4>',
      post += '  </div>',
      post += '  <div id="collapse'+id+'" class="panel-collapse collapse in" role="tabpanel" aria-labelledby="heading'+id+'">'
      post += '    <div class="panel-body">',
      post += '      <p>'+message+'</p>',
      post += '      <div class="pull-left">',
      post += '        <p class="text-opac">Origin: '+origin+'</p>',
      post += '      </div>',
      post += '      <div class="pull-right">',
      post += '        <p class="text-opac">Author: '+author+'</br>',
      post += '        Location: '+location+'</p>',
      post += '      </div>',
      post += '    </div>',
      post += '  </div>',
      post += '</div>',
  $('#post-container').append(post);
};

/**
 *  DISCLAIMER OF WARRANTIES:                                                 
 *  -------------------------                                                
 *  The following [enclosed] code is sample code created by IBM Corporation.
 *  This sample code is provided to you solely for the purpose of assisting
 *  you in the development of your applications.
 *  The code is provided "AS IS", without warranty of any kind. IBM shall
 *  not be liable for any damages arising out of your use of the sample code,
 *  even if they have been advised of the possibility of such damages.
 *
 * (c) Copyright IBM Corp. 2011. All rights reserved. 
 */
 
/**
 * This is a sample for an Active Site Analytics aggregator.
 *
 * It uses the Active Site Analytics Mediator SPI to register with the portal
 * framework to get notified about DOM changes. Upon receiving a DOM notification,
 * the aggregator parses the DOM to find the microformats that are relevant
 * for Active Site Analytics (all microformats that start with an "asa." prefix).
 *
 * The detected microformats are collected into an internal buffer. They are sent
 * to an external analytics service upon receiving an "beforeunload" event. The data
 * is communicated by injecting a 1x1 pixel image into the page. Before loading the
 * tracking image, the aggregator will append the collected data as a query sting to
 * the image URL. The resulting URL will look like this:
 *    http://example.org/tracking.gif?asa.page.title=My%20Page&asa.visitor=user4...
 *
 * To add this sample aggregator to a portal page, follow the topic "Adding an Active
 * Site Analytics aggregator to a portal page" in the product documentation. Refer to
 * the topic "Writing an aggregator for Active Site Analytics" to find more information
 * about how you can implemement aggregators and to find further code samples.
 */
(function(){

  /**
   * Function to construct the aggregator
   */
  var SampleAggregator = function (/*String*/trackingImageURL) {
  
    /**
     * The aggregator instance
     */
    var aggregator = {};
  
    /**
     * The URL of the tracking image.
     */
    var trackingImg = trackingImageURL;
  
    /**
     * ID of the HTML image element that is used to load
     * the tracking image.
     */
    var trackingImgID = "asa_tracking_img";
	
    /**
     * Map to store the analytics microformat instances
     */
    var tags = {};

    /**
     * Public function to submits the collected data to the
     * analytics service
     */
    aggregator.submit = function() {
      // check if there is data in our buffer
	  if (!isEmpty()) {
        // create the URL
        var imgURL = createTrackingImageURL();
        // load the image
        loadTrackingImage(imgURL);
	    // clear the data
        tags = {};
	  }
    };
  
    /**
     * Public function which parses the given DOM nodes to detect
     * ASA microformats. Parses the entire DOM if no specific nodes
     * are provided.
     */
    aggregator.parse = function(/*DOMNode[]*/ nodes, /*Function?*/ callback) {
      // check if a specific part of the DOM should be parsed
      if (nodes && nodes.length > 0) {
        /*
         * Page element notification
         */
        // iterate over nodes
        for (var i = nodes.length - 1; i >= 0; --i) {
          // parse the node
          parse(nodes[i]);
        }
      } else {
        /*
         * Page notification
         */
        // locate our root element which contains all
        // page-specific microformats in its subtree
        var asaPageRoot = document.getElementById("asa.page");
        if (asaPageRoot) {
          parse(asaPageRoot);
        }
      }
      // invoke the callback (if any)
      if (callback) {
        callback();
      }
    };
	
    /**
     * Parses the DOM subtree rooted at the given node.
     */
    var parse = function(/*DOMNode*/ node) {
      // get the span elements
      var spans = node.getElementsByTagName("span");
      if (spans && spans.length > 0) {
        // iterate
        var len = spans.length;
        for (var i = 0; i < len; i++) {
          // visit the current span element
          if (!onNode(spans[i])) {
            break;
          }
        }
      }
    };
		
    /**
     * Parses the given node to locate the ASA microformats
     * we are interested in.
     */
    var onNode = function(/*DOMNode*/ node) {
      // get the CSS classes
      var classes = getClasses(node);
      if (classes && classes.length > 0) {
        // iterate
        for (var i = classes.length - 1; i >= 0; i--) {
          // get the current class
          var cls = classes[i];
          if (cls.indexOf("asa.") === 0) {
            onTag(cls, node.innerHTML);
          }
        }
      }
      return true;
    };
	
    /**
     * Handles the given tag.
     */
    var onTag = function(/*String*/ name, /*String*/ value) {
      var bucket = tags[name];
      if (!bucket) {
        bucket = [];
        tags[name] = bucket;
      }
      if (!contains(bucket, value)) {
        bucket.push(value);
      }
    };
	
    /**
     * Loads the tracking image using the given URL
     */
    var loadTrackingImage = function(/*String*/ imgURL) {
      // check if the element exists already
      var img = document.getElementById(trackingImgID);
      if (!img) {
        // create a new image element
        img = document.createElement("img");
        // make it invisible
        img.setAttribute("style", "display:none;");
        // set the id
        img.id = trackingImgID;
        // append it to the body element
        document.getElementsByTagName("body")[0].appendChild(img);
      }
      // set the image URL
      img.setAttribute("src", imgURL);
    };
	
    /**
     * Assembles the URL of the tracking image which is used
     * to communicate the collected data to the analytics
     * service
     */
    var createTrackingImageURL = function() {			
      var url = [];
      // add the base URL
      url.push(trackingImg);
      url.push("?");
      // iterate over the collected tags
      for (var name in tags) {
        var encodedName = encodeURIComponent(name);
        var value = tags[name];
        if (value) {
          if (isArray(value)) {
            for (var i = value.length - 1; i >= 0; --i) {
              url.push(encodedName);
              url.push("=");
              url.push(encodeURIComponent(value[i]));
              url.push("&");
            }
          } else {
            url.push(encodedName);
            url.push("=");
            url.push(value);
            url.push("&");
          }
        }
      }
      // serialize the URL
      return url.join("");
    };
	
    /**
     * Returns the CSS classes of the given node.
     */
    var getClasses = function(/*DOMNode*/ node) {
      // get the value of the class attribute
      var clsAttr = node.getAttribute("class");
      // initialize the result array
      return clsAttr ? clsAttr.split(" ") : [];
    };
	
    /**
     * Checks if the given object is an array.
     */
    var isArray = function(obj) {
      return obj && (typeof obj === "array" || obj instanceof Array);
    };
  
    /**
     * Checks if our internal data buffer is empty
     */
    var isEmpty = function() {
      for (var tag in tags) {
        return false;
      }
      return true;
    };
  
    /**
     * Checks if the given object is part of the given array.
     */
    var contains = function(arr, obj) {
      if (arr) {
        var len = arr.length
        for (var i = len - 1; i >= 0; --i) {
          if (arr[i] === obj) {
            return true;
          }
        }
      }
      return false;
    };
  
    // return the aggregator
    return aggregator;
  
  };

  // instantiate the aggregator
  var imgURL = "http://example.org/tracking.gif";
  var interval = 30000;
  var aggregator = new SampleAggregator(imgURL);

  // callback function to submit the collected data to the external analytics service
  var submit = function() {
    aggregator.submit.apply(aggregator, arguments);
  };

  // register the aggregator
  com.ibm.portal.analytics.SiteAnalyticsMediator.register(function() {
    aggregator.parse.apply(aggregator, arguments);
  });

  // activate the send interval
  setInterval(submit, interval);
  
  // register the callbacks for registration and data submission
  if (window.addEventListener) {
    // W3C
    window.addEventListener("beforeunload", submit, false);
  } else if (window.attachEvent) {
    // Microsoft
    window.attachEvent("onunload", submit);
  }
  
})();
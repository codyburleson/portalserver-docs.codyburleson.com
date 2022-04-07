/**
 *  DISCLAIMER OF WARRANTIES:                                                 
 *  -------------------------                                                
 *  The following [enclosed] code is sample code created by HCL Technologies Ltd..
 *  This sample code is provided to you solely for the purpose of assisting
 *  you in the development of your applications.
 *  The code is provided "AS IS", without warranty of any kind. HCL Technologies Ltd. shall
 *  not be liable for any damages arising out of your use of the sample code,
 *  even if they have been advised of the possibility of such damages.
 *
 * (c) Copyright HCL Technologies Ltd. 2020. All rights reserved. 
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
 * to an external analytics service upon receiving an "beforeunload" event. 
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
    var GoogleAnalytics = function () {
    
      /**
       * The aggregator instance
       */
      var aggregator = {};
    
      /**
       * Additional configuration for Google Analytics
       * 
       * Example:
       * var config = { "custom_map": { "dimension1": "asa.page.id" }};
       */
      var config = {};
      
      /**
       * Map to store the analytics microformat instances
       */
      var tags = {};

      /**
       * Simple object check.
       */
      const isObject = function(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
      }
      
      /**
       * Deep merge two objects.
       */
      const mergeDeep = function(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
      
        if (isObject(target) && isObject(source)) {
          for (const key in source) {
            if (isObject(source[key])) {
              if (!target[key]) { 
                Object.assign(target, { [key]: {} });
              }
              mergeDeep(target[key], source[key]);
            } else {
              Object.assign(target, { [key]: source[key] });
            }
          }
        }
        return mergeDeep(target, ...sources);
      }

      const setDeepValue = function(obj, value, path) {
        if (typeof path === 'string') {
          var path = path.split('.');
        }
    
        if(path.length > 1){
          var parentObjKey = path.shift();
          if(obj[parentObjKey] == null || typeof obj[parentObjKey] !== 'object'){
                obj[parentObjKey] = {};
          }
          setDeepValue(obj[parentObjKey], value, path);
        } else {
          obj[path[0]] = value;
        }
      }
  
      /**
       * The global gtag object 
       */
      var setupGTAG = function(){
        if(!window.gtag && window.ibm_page_metadata != undefined){
          if (window.ibm_page_metadata['ga.optout'] != undefined && window.ibm_page_metadata['ga.optout'] == 'true') {
            window[`ga-disable-${window.ibm_page_metadata.ga_measurement_id}`] = true;
          } else {
            window[`ga-disable-${window.ibm_page_metadata.ga_measurement_id}`] = false;
          }
          var configFromMetadata = {};
          for (let key_value_pair of Object.entries(window.ibm_page_metadata)) {
            let [key, value] = key_value_pair
            if (key.includes('ga.config')) {
              const configKey = key.replace('ga.config.', '');
              if (configKey.includes('.')) {
                const obj = {}
                setDeepValue(obj, value, configKey);
                configFromMetadata = mergeDeep(configFromMetadata, obj);
              } else {
                configFromMetadata[configKey] = value
              }
            }
          }
          var mergedConfig = mergeDeep(config, configFromMetadata);
          window.dataLayer = window.dataLayer || [];
          window.gtag = function(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('set', tags);
          gtag('config', window.ibm_page_metadata.ga_measurement_id, mergedConfig);
        }
      }
    
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
            setupGTAG();
            if(window.gtag) {
              window.gtag('set', tags);
            }
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
            setupGTAG();
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
       * Returns the CSS classes of the given node.
       */
      var getClasses = function(/*DOMNode*/ node) {
        // get the value of the class attribute
        var clsAttr = node.getAttribute("class");
        // initialize the result array
        return clsAttr ? clsAttr.split(" ") : [];
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
    var aggregator = new GoogleAnalytics();
  
    // register the aggregator
    com.ibm.portal.analytics.SiteAnalyticsMediator.register(function() {
      aggregator.parse.apply(aggregator, arguments);
    });
    
  })();
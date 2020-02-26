import { logger } from "../polyfill";
import { putPreloader, formatPhoneNumber } from "../../components/misc";
import Scrollable from '../../components/scrollable';
import appMessagesManager, { AppMessagesManager } from "./appMessagesManager";
import appDialogsManager from "./appDialogsManager";
import { isElementInViewport, numberWithCommas } from "../utils";
import appMessagesIDsManager from "./appMessagesIDsManager";
import appImManager from "./appImManager";
import appUsersManager from "./appUsersManager";
import { appPeersManager } from "../services";

let testScroll = false;

class SearchGroup {
  container: HTMLDivElement;
  nameEl: HTMLDivElement;
  list: HTMLUListElement;

  constructor(public name: string, public type: string) {
    this.list = document.createElement('ul');
    this.container = document.createElement('div');
    this.nameEl = document.createElement('div');
    this.nameEl.classList.add('search-group__name');
    this.nameEl.innerText = name;

    this.container.classList.add('search-group');
    this.container.append(this.nameEl, this.list);
    this.container.style.display = 'none';

    //appDialogsManager.setListClickListener(this.list);
  }

  clear() {
    this.container.style.display = 'none';
    this.list.innerHTML = '';
  }

  setActive() {
    this.container.style.display = '';
  }
}

class AppSidebarLeft {
  private sidebarEl = document.querySelector('.page-chats .chats-container') as HTMLDivElement;
  private searchInput = document.getElementById('global-search') as HTMLInputElement;
  private toolsBtn = this.sidebarEl.querySelector('.sidebar-tools-button') as HTMLButtonElement;
  private backBtn = this.sidebarEl.querySelector('.sidebar-back-button') as HTMLButtonElement;
  private searchContainer = this.sidebarEl.querySelector('#search-container') as HTMLDivElement;
  
  private menuEl = this.toolsBtn.querySelector('.btn-menu');
  private savedBtn = this.menuEl.querySelector('.menu-saved');
  private archivedBtn = this.menuEl.querySelector('.menu-archive');
  public archivedCount = this.archivedBtn.querySelector('.archived-count') as HTMLSpanElement;
  
  private listsContainer: HTMLDivElement = null;
  
  private chatsArchivedContainer = document.getElementById('chats-archived-container') as HTMLDivElement;
  private chatsContainer = document.getElementById('chats-container') as HTMLDivElement;
  private chatsArchivedOffsetIndex = 0;
  private chatsOffsetIndex = 0;
  private chatsPreloader: HTMLDivElement;
  //private chatsLoadCount = 0;
  //private loadDialogsPromise: Promise<any>;
  private loadDialogsPromise: ReturnType<AppMessagesManager["getConversations"]>;
  
  private log = logger('SL');
  
  private peerID = 0;
  private minMsgID = 0;
  private loadedCount = 0;
  private foundCount = 0;
  private offsetRate = 0;
  
  private searchPromise: Promise<void> = null;
  private searchTimeout: number = 0;
  
  private query = '';

  public scroll: Scrollable = null;
  public scrollArchived: Scrollable = null;

  public searchGroups: {[group: string]: SearchGroup} = {
    contacts: new SearchGroup('Contacts and Chats', 'contacts'),
    globalContacts: new SearchGroup('Global Search', 'contacts'),
    globalMessages: new SearchGroup('Global Search', 'messages'),
    privateMessages: new SearchGroup('Private Search', 'messages')
  };

  constructor() {
    this.chatsPreloader = document.createElement('div');
    this.chatsPreloader.classList.add('preloader');
    putPreloader(this.chatsPreloader);
    //this.chatsContainer.append(this.chatsPreloader);
    
    //this.chatsLoadCount = Math.round(document.body.scrollHeight / 70 * 1.5);
    
    this.scroll = new Scrollable(this.chatsContainer as HTMLDivElement, false, true, 300, 'CL');
    this.scroll.setVirtualContainer(appDialogsManager.chatList);
    this.scroll.onScrolledBottom = this.onChatsScroll.bind(this);
    appDialogsManager.chatsHidden = this.scroll.hiddenElements;
    //this.scroll.container.addEventListener('scroll', this.onChatsScroll.bind(this));

    this.scrollArchived = new Scrollable(this.chatsArchivedContainer as HTMLDivElement, false, true, 300, 'CLA');
    this.scrollArchived.setVirtualContainer(appDialogsManager.chatListArchived);
    appDialogsManager.chatsArchivedHidden = this.scrollArchived.hiddenElements;
    //this.scrollArchived.container.addEventListener('scroll', this.onChatsArchivedScroll.bind(this));
    
    this.listsContainer = new Scrollable(this.searchContainer).container;
    for(let i in this.searchGroups) {
      this.listsContainer.append(this.searchGroups[i].container);
    }
    
    this.savedBtn.addEventListener('click', (e) => {
      ///////this.log('savedbtn click');
      setTimeout(() => { // menu doesn't close if no timeout (lol)
        let dom = appDialogsManager.getDialogDom(appImManager.myID);
        if(dom) {
          dom.listEl.click();
        } else {
          appImManager.setPeer(appImManager.myID);
        }
      }, 0);
    });
    
    this.archivedBtn.addEventListener('click', (e) => {
      this.chatsArchivedContainer.classList.add('active');
      this.toolsBtn.classList.remove('active');
      this.backBtn.classList.add('active');
      //this.toolsBtn.classList.remove('tgico-menu', 'btn-menu-toggle');
      //this.toolsBtn.classList.add('tgico-back');
    });
    
    if(testScroll) {
      for(let i = 0; i < 1000; ++i) {
        let li = document.createElement('li');
        li.dataset.id = '' + i;
        li.innerHTML = `<div class="rp"><div class="user-avatar" style="background-color: rgb(166, 149, 231); font-size: 0px;"><img src="blob:https://localhost:9000/ce99a2a3-f34b-4ca1-a09e-f716f89930d8"></div><div class="user-caption"><p><span class="user-title">${i}</span><span><span class="message-status"></span><span class="message-time">18:33</span></span></p><p><span class="user-last-message"><b>Ильяс: </b>Гагагагга</span><span></span></p></div></div>`;
        this.scroll.append(li);
      }
    }
    
    this.listsContainer.addEventListener('scroll', this.onSidebarScroll.bind(this));

    this.searchInput.addEventListener('focus', (e) => {
      this.toolsBtn.classList.remove('active');
      this.backBtn.classList.add('active');
      this.searchContainer.classList.add('active');
      
      if(!this.searchInput.value) {
        for(let i in this.searchGroups) {
          this.searchGroups[i].clear();
        }
      }

      this.searchInput.addEventListener('blur', (e) => {
        if(!this.searchInput.value) {
          this.toolsBtn.classList.add('active');
          this.backBtn.classList.remove('active');
          this.searchContainer.classList.remove('active');
          this.backBtn.click();
        }
        
        /* this.peerID = 0;
        this.loadedCount = 0;
        this.minMsgID = 0; */
      }, {once: true});
    });
    
    this.searchInput.addEventListener('input', (e) => {
      //console.log('messageInput input', this.innerText, serializeNodes(Array.from(messageInput.childNodes)));
      let value = this.searchInput.value;
      ////////this.log('input', value);
      
      if(!value.trim()) {
        //this.peerID = 0;
        return;
      }
      
      this.query = value;
      this.minMsgID = 0;
      this.loadedCount = 0;
      this.foundCount = 0;
      this.offsetRate = 0;
      
      for(let i in this.searchGroups) {
        this.searchGroups[i].clear();
      }
      
      this.searchPromise = null;
      this.searchMore();
    });

    this.backBtn.addEventListener('click', (e) => {
      this.chatsArchivedContainer.classList.remove('active');
      this.toolsBtn.classList.add('active');
      this.backBtn.classList.remove('active');
      this.searchInput.value = '';
      this.searchContainer.classList.remove('active');
      this.peerID = 0;
    });
    
    window.addEventListener('resize', () => {
      //this.chatsLoadCount = Math.round(document.body.scrollHeight / 70 * 1.5);
      
      setTimeout(() => {
        this.onSidebarScroll();
        this.scroll.onScroll();
        //this.onChatsScroll();
        this.onChatsArchivedScroll();
      }, 0);
    });

    /* appUsersManager.getTopPeers().then(categories => {
      this.log('got top categories:', categories);
    }); */
  }
  
  public async loadDialogs(archived = false) {
    if(testScroll) {
      return;
    }
    
    if(this.loadDialogsPromise/*  || 1 == 1 */) return this.loadDialogsPromise;
    
    (archived ? this.chatsArchivedContainer : this.chatsContainer).append(this.chatsPreloader);
    
    //let offset = appMessagesManager.generateDialogIndex();/* appMessagesManager.dialogsNum */;

    let offset = archived ? this.chatsArchivedOffsetIndex : this.chatsOffsetIndex;
    //let offset = 0;
    
    
    try {
      console.time('getDialogs time');
      this.loadDialogsPromise = appMessagesManager.getConversations('', offset, 50/*this.chatsLoadCount */, +archived);
      
      let result = await this.loadDialogsPromise;

      console.timeEnd('getDialogs time');
      
      if(result && result.dialogs && result.dialogs.length) {
        let index = result.dialogs[result.dialogs.length - 1].index;

        if(archived) this.chatsArchivedOffsetIndex = index;
        else this.chatsOffsetIndex = index;

        result.dialogs.forEach((dialog: any) => {
          appDialogsManager.addDialog(dialog);
        });
      }

      /* if(archived) {
        let count = result.count;
        this.archivedCount.innerText = '' + count;
      } */

      //this.log('getDialogs ' + this.chatsLoadCount + ' dialogs by offset:', offset, result, this.scroll.hiddenElements);
      this.scroll.onScroll();
    } catch(err) {
      this.log.error(err);
    }
    
    this.chatsPreloader.remove();
    this.loadDialogsPromise = undefined;
  }
  
  public onChatsScroll() {
    //this.log(this.scroll.hiddenElements.down.length, this.loadDialogsPromise, appDialogsManager.chatList.childNodes);
    if(this.scroll.hiddenElements.down.length > 0 || this.loadDialogsPromise/*  || 1 == 1 */) return;
    
    this.loadDialogs();
  }

  public onChatsArchivedScroll() {
    //this.log(this.scrollArchived.hiddenElements.down.length, this.loadDialogsPromise, appDialogsManager.chatListArchived.childNodes);
    if(this.scrollArchived.hiddenElements.down.length > 0/*  || 1 == 1 */) return;
    
    if(!this.loadDialogsPromise) {
      let d = Array.from(appDialogsManager.chatListArchived.childNodes).slice(-5);
      for(let node of d) {
        if(isElementInViewport(node)) {
          this.loadDialogs(true);
          break;
        }
      }
      
      //console.log('last 5 dialogs:', d);
    }
  }
  
  public onSidebarScroll() {
    if(!this.query.trim()) return;
    
    let elements = Array.from(this.searchGroups[this.peerID ? 'privateMessages' : 'globalMessages'].list.childNodes).slice(-5);
    for(let li of elements) {
      if(isElementInViewport(li)) {
        this.log('Will load more search');
        
        if(!this.searchTimeout) {
          this.searchTimeout = setTimeout(() => {
            this.searchMore();
            this.searchTimeout = 0;
          }, 0);
        }
        
        break;
      }
    }
  }
  
  public beginSearch(peerID?: number) {
    if(peerID) {
      this.peerID = peerID;
    }
    
    this.searchInput.focus();
  }
  
  private searchMore() {
    if(this.searchPromise) return this.searchPromise;
    
    let query = this.query;
    
    if(!query.trim()) return;
    
    if(this.loadedCount != 0 && this.loadedCount >= this.foundCount) {
      return Promise.resolve();
    }
    
    let maxID = appMessagesIDsManager.getMessageIDInfo(this.minMsgID)[0];

    if(!this.peerID && !maxID) {
      appUsersManager.searchContacts(query, 20).then((contacts: any) => {
        if(this.searchInput.value != query) {
          return;
        }

        ///////this.log('input search contacts result:', contacts);

        let setResults = (results: any, group: SearchGroup, showMembersCount = false) => {
          results.forEach((inputPeer: any) => {
            let peerID = appPeersManager.getPeerID(inputPeer);
            let peer = appPeersManager.getPeer(peerID);
            let originalDialog = appMessagesManager.getDialogByPeerID(peerID)[0];

            //////////this.log('contacts peer', peer);
          
            if(!originalDialog) {
              /////////this.log('no original dialog by peerID:', peerID);
              
              originalDialog = {
                peerID: peerID,
                pFlags: {},
                peer: peer
              };
            }
            
            let {dialog, dom} = appDialogsManager.addDialog(originalDialog, group.list, false);

            if(showMembersCount && (peer.participants_count || peer.participants)) {
              let isChannel = appPeersManager.isChannel(peerID) && !appPeersManager.isMegagroup(peerID);
              let participants_count = peer.participants_count || peer.participants.participants.length;
              let subtitle = numberWithCommas(participants_count) + ' ' + (isChannel ? 'subscribers' : 'members');
              dom.lastMessageSpan.innerText = subtitle;
            } else {
              let username = appPeersManager.getPeerUsername(peerID);
              if(!username) {
                let user = appUsersManager.getUser(peerID);
                if(user && user.phone) {
                  username = '+' + formatPhoneNumber(user.phone).formatted;
                }
              } else {
                username = '@' + username;
              }

              dom.lastMessageSpan.innerText = username;
            }
          });

          if(results.length) {
            group.setActive();
          }
        };

        setResults(contacts.my_results, this.searchGroups.contacts, true);
        setResults(contacts.results, this.searchGroups.globalContacts);
      });
    }
    
    return this.searchPromise = appMessagesManager.getSearch(this.peerID, query, null, maxID, 20, this.offsetRate).then(res => {
      this.searchPromise = null;
      
      if(this.searchInput.value != query) {
        return;
      }
      
      /////////this.log('input search result:', this.peerID, query, null, maxID, 20, res);
      
      let {count, history, next_rate} = res;
      
      if(history[0] == this.minMsgID) {
        history.shift();
      }
      
      let searchGroup = this.searchGroups[this.peerID ? 'privateMessages' : 'globalMessages'];
      searchGroup.setActive();

      history.forEach((msgID: number) => {
        let message = appMessagesManager.getMessage(msgID);
        let originalDialog = appMessagesManager.getDialogByPeerID(message.peerID)[0];
        
        if(!originalDialog) {
          ////////this.log('no original dialog by message:', message);
          
          originalDialog = {
            peerID: message.peerID,
            pFlags: {},
            peer: message.to_id
          };
        }
        
        let {dialog, dom} = appDialogsManager.addDialog(originalDialog, searchGroup.list, false);
        appDialogsManager.setLastMessage(dialog, message, dom);
      });
      
      this.minMsgID = history[history.length - 1];
      this.offsetRate = next_rate;
      this.loadedCount += history.length;
      
      if(!this.foundCount) {
        this.foundCount = count;
      }
    }).catch(err => {
      this.log.error('search error', err);
      this.searchPromise = null;
    });
  }
}

export default new AppSidebarLeft();

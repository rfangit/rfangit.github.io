---
layout: default
permalink: /blog/
title: blog
nav: true
nav_order: 3
pagination:
  enabled: true
  collection: posts
  permalink: /page/:num/
  per_page: 10
  sort_field: date
  sort_reverse: true
  trail:
    before: 1 # The number of links before the current page
    after: 3 # The number of links after the current page
---

<div class="blog-list minimalist">

  <h1>{{ site.blog_name | default: "Blog" }}</h1>
  {% if site.blog_description %}
    <p>{{ site.blog_description }}</p>
  {% endif %}

  <ul class="post-list compact">
    {% assign postlist = paginator.posts %}
    {% for post in postlist %}
      <li>
        <span class="post-date">{{ post.date | date: "%Y-%m-%d" }}</span>
        <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title }}</a>
      </li>
    {% endfor %}
  </ul>

{% if page.pagination.enabled %}
{% include pagination.liquid %}
{% endif %}

</div>
